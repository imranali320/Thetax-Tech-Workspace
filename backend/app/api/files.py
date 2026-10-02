import os
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.config import settings
from ..db.models import AuditLog, FileRecord, FileVersion, User
from ..db.session import get_db
from ..schemas.file import FileOut, FileVersionOut
from .deps import get_current_user

router = APIRouter(prefix="/files", tags=["files"])

HR_ROLES = {"owner", "hr"}
SEE_ALL_ROLES = {"owner", "admin", "hr"}


def visible_to(f: FileRecord, user: User) -> bool:
    if f.visibility == "hr":
        return user.role in HR_ROLES or f.folder_employee == user.id
    if user.role in SEE_ALL_ROLES or f.owner_id == user.id:
        return True
    if f.visibility == "company":
        return True
    if f.visibility == "department":
        return f.folder_dept == user.dept
    if f.visibility == "project":
        # No backend Projects module yet — membership can't be checked here, so any
        # authenticated user can see project-folder files until that module exists.
        return True
    return False


def to_out(f: FileRecord) -> FileOut:
    last = f.versions[-1]
    return FileOut(
        id=f.id, name=f.name, size=last.size, mime_type=f.mime_type, owner_id=f.owner_id,
        folder_dept=f.folder_dept, folder_project=f.folder_project, folder_employee=f.folder_employee,
        visibility=f.visibility, at=last.created_at,
        versions=[FileVersionOut(v=v.version, at=v.created_at, by=v.uploaded_by) for v in f.versions],
    )


@router.post("", response_model=FileOut)
async def upload_file(
    file: UploadFile,
    folder_dept: str | None = Form(None),
    folder_project: str | None = Form(None),
    folder_employee: str | None = Form(None),
    visibility: str = Form("company"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if visibility == "hr" and user.role not in HR_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only HR/Owner can upload to the HR folder")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in settings.allowed_ext_set:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f".{ext} files aren't allowed")

    content = await file.read()
    if len(content) > settings.max_file_mb * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"Over the {settings.max_file_mb} MB limit")

    os.makedirs(settings.storage_dir, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}_{file.filename}"
    with open(os.path.join(settings.storage_dir, stored_name), "wb") as out:
        out.write(content)

    existing = db.scalar(
        select(FileRecord).where(
            FileRecord.name == file.filename,
            FileRecord.folder_dept == folder_dept,
            FileRecord.folder_project == folder_project,
        )
    )
    if existing:
        version = FileVersion(
            file_id=existing.id, version=len(existing.versions) + 1, stored_name=stored_name,
            size=len(content), uploaded_by=user.id,
        )
        db.add(version)
        existing.mime_type = file.content_type or existing.mime_type
        db.add(AuditLog(user_id=user.id, action="file.version", entity="file", entity_id=existing.id, meta=f"{file.filename} v{version.version}"))
        db.commit()
        db.refresh(existing)
        return to_out(existing)

    record = FileRecord(
        name=file.filename, mime_type=file.content_type or "application/octet-stream", owner_id=user.id,
        folder_dept=folder_dept, folder_project=folder_project, folder_employee=folder_employee,
        visibility=visibility,
    )
    db.add(record)
    db.flush()
    db.add(FileVersion(file_id=record.id, version=1, stored_name=stored_name, size=len(content), uploaded_by=user.id))
    db.add(AuditLog(user_id=user.id, action="file.upload", entity="file", entity_id=record.id, meta=file.filename))
    db.commit()
    db.refresh(record)
    return to_out(record)


@router.get("", response_model=list[FileOut])
def list_files(
    dept: str | None = None, project: str | None = None, employee: str | None = None,
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    q = select(FileRecord)
    if dept:
        q = q.where(FileRecord.folder_dept == dept)
    if project:
        q = q.where(FileRecord.folder_project == project)
    if employee:
        q = q.where(FileRecord.folder_employee == employee)
    records = db.scalars(q).all()
    return [to_out(f) for f in records if visible_to(f, user)]


@router.get("/{file_id}/download")
def download_file(file_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    f = db.get(FileRecord, file_id)
    if not f or not visible_to(f, user):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found")
    last = f.versions[-1]
    path = os.path.join(settings.storage_dir, last.stored_name)
    if not os.path.exists(path):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File content missing on server")
    db.add(AuditLog(user_id=user.id, action="file.download", entity="file", entity_id=f.id, meta=f.name))
    db.commit()
    return FileResponse(path, filename=f.name, media_type=f.mime_type)
