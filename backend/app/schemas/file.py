from datetime import datetime

from pydantic import BaseModel


class FileVersionOut(BaseModel):
    v: int
    at: datetime
    by: str


class FileOut(BaseModel):
    id: str
    name: str
    size: int
    mime_type: str
    owner_id: str
    folder_dept: str | None
    folder_project: str | None
    folder_employee: str | None
    visibility: str
    at: datetime
    versions: list[FileVersionOut]
