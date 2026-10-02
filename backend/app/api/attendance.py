import base64
import os
import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.config import settings
from ..db.models import Attendance, AttendanceBreak, AttendanceCorrection, AuditLog, User
from ..db.session import get_db
from ..schemas.attendance import AttendanceOut, BreakOut, CheckInIn, CorrectionIn, CorrectionOut, EventOut
from .deps import get_current_user, require_can
from .settings import get_or_create as get_settings

router = APIRouter(prefix="/attendance", tags=["attendance"])

SEE_TEAM_ROLES = {"owner", "admin", "hr", "lead"}


def to_epoch_ms(dt: datetime | None) -> int | None:
    if dt is None:
        return None
    return int(dt.replace(tzinfo=timezone.utc).timestamp() * 1000)


def today_key() -> str:
    return date.today().isoformat()


def combine(date_str: str, hhmm: str) -> datetime:
    return datetime.strptime(f"{date_str} {hhmm}", "%Y-%m-%d %H:%M")


def to_out(rec: Attendance) -> AttendanceOut:
    events = []
    if rec.check_in:
        events.append(EventOut(type="check_in", at=to_epoch_ms(rec.check_in)))
    for b in rec.breaks:
        events.append(EventOut(type="break_start", at=to_epoch_ms(b.start_time)))
        if b.end_time:
            events.append(EventOut(type="break_end", at=to_epoch_ms(b.end_time)))
    for c in rec.corrections:
        events.append(EventOut(type="corrected", at=to_epoch_ms(c.at)))
    if rec.check_out:
        events.append(EventOut(type="check_out", at=to_epoch_ms(rec.check_out)))
    events.sort(key=lambda e: e.at)

    return AttendanceOut(
        id=rec.id, user_id=rec.user_id, date=rec.date,
        check_in=to_epoch_ms(rec.check_in), check_out=to_epoch_ms(rec.check_out), late=rec.late,
        selfie=rec.id if rec.selfie_path else None,
        breaks=[BreakOut(id=b.id, start=to_epoch_ms(b.start_time), end=to_epoch_ms(b.end_time)) for b in rec.breaks],
        corrections=[CorrectionOut(at=to_epoch_ms(c.at), by=c.by_id, reason=c.reason, before=c.before) for c in rec.corrections],
        events=events,
    )


def save_selfie_file(data_url: str) -> str:
    os.makedirs(settings.selfie_dir, exist_ok=True)
    _, _, b64data = data_url.partition(",")
    raw = base64.b64decode(b64data or data_url)
    name = f"{uuid.uuid4().hex}.jpg"
    with open(os.path.join(settings.selfie_dir, name), "wb") as out:
        out.write(raw)
    return name


@router.post("/check-in", response_model=AttendanceOut)
def check_in(body: CheckInIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    today = today_key()
    if db.scalar(select(Attendance).where(Attendance.user_id == user.id, Attendance.date == today)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Already checked in today")

    cs = get_settings(db)
    now = datetime.utcnow()
    shift_start = combine(today, user.shift)
    late = now > shift_start + timedelta(minutes=cs.grace_mins)

    rec = Attendance(user_id=user.id, date=today, check_in=now, late=late)
    if body.selfie:
        rec.selfie_path = save_selfie_file(body.selfie)
    db.add(rec)
    db.add(AuditLog(user_id=user.id, action="attendance.check_in", entity="attendance", entity_id=user.id, meta="Late check-in" if late else "On time"))
    db.commit()
    db.refresh(rec)
    return to_out(rec)


def _today_record_or_404(db: Session, user: User) -> Attendance:
    rec = db.scalar(select(Attendance).where(Attendance.user_id == user.id, Attendance.date == today_key()))
    if not rec or not rec.check_in:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You haven't checked in today")
    return rec


@router.post("/break/start", response_model=AttendanceOut)
def start_break(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rec = _today_record_or_404(db, user)
    if rec.check_out:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You've already checked out today")
    if any(b.end_time is None for b in rec.breaks):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A break is already in progress")
    cs = get_settings(db)
    if not cs.multi_break and len(rec.breaks) >= 1:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only one break is allowed per day")
    db.add(AttendanceBreak(attendance_id=rec.id, start_time=datetime.utcnow()))
    db.commit()
    db.refresh(rec)
    return to_out(rec)


@router.post("/break/end", response_model=AttendanceOut)
def end_break(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rec = _today_record_or_404(db, user)
    active = next((b for b in rec.breaks if b.end_time is None), None)
    if not active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No break is currently active")
    active.end_time = datetime.utcnow()
    db.commit()
    db.refresh(rec)
    return to_out(rec)


@router.post("/check-out", response_model=AttendanceOut)
def check_out(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rec = _today_record_or_404(db, user)
    if rec.check_out:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Already checked out today")
    active = next((b for b in rec.breaks if b.end_time is None), None)
    now = datetime.utcnow()
    if active:
        active.end_time = now
    rec.check_out = now
    db.add(AuditLog(user_id=user.id, action="attendance.check_out", entity="attendance", entity_id=user.id, meta=""))
    db.commit()
    db.refresh(rec)
    return to_out(rec)


@router.get("/today", response_model=AttendanceOut | None)
def get_today(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rec = db.scalar(select(Attendance).where(Attendance.user_id == user.id, Attendance.date == today_key()))
    return to_out(rec) if rec else None


@router.get("", response_model=list[AttendanceOut])
def list_attendance(date: str | None = None, user_id: str | None = None, limit: int = 60, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    can_see_team = user.role in SEE_TEAM_ROLES
    target_user_id = user_id
    if target_user_id and target_user_id != user.id and not can_see_team:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed to view this employee's attendance")
    if not target_user_id and not can_see_team:
        target_user_id = user.id

    q = select(Attendance)
    if date:
        q = q.where(Attendance.date == date)
    if target_user_id:
        q = q.where(Attendance.user_id == target_user_id)
    q = q.order_by(Attendance.date.desc()).limit(limit)
    return [to_out(r) for r in db.scalars(q).all()]


@router.get("/{attendance_id}/selfie")
def get_selfie(attendance_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rec = db.get(Attendance, attendance_id)
    if not rec or not rec.selfie_path:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No selfie for this record")
    if rec.user_id != user.id and user.role not in SEE_TEAM_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed")
    path = os.path.join(settings.selfie_dir, rec.selfie_path)
    if not os.path.exists(path):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Selfie file missing on server")
    return FileResponse(path, media_type="image/jpeg")


@router.post("/correct", response_model=AttendanceOut)
def correct(body: CorrectionIn, db: Session = Depends(get_db), actor: User = Depends(require_can("correctAttendance"))):
    target_user = db.get(User, body.user_id)
    if not target_user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Employee not found")

    def fmt(dt: datetime | None) -> str:
        return dt.strftime("%H:%M") if dt else "—"

    rec = db.scalar(select(Attendance).where(Attendance.user_id == body.user_id, Attendance.date == body.date))
    before = f"{fmt(rec.check_in if rec else None)}–{fmt(rec.check_out if rec else None)}"
    if not rec:
        rec = Attendance(user_id=body.user_id, date=body.date)
        db.add(rec)
        db.flush()

    rec.check_in = combine(body.date, body.check_in) if body.check_in else None
    rec.check_out = combine(body.date, body.check_out) if body.check_out else None
    cs = get_settings(db)
    rec.late = bool(rec.check_in and rec.check_in > combine(body.date, target_user.shift) + timedelta(minutes=cs.grace_mins))

    db.add(AttendanceCorrection(attendance_id=rec.id, by_id=actor.id, reason=body.reason, before=before))
    db.add(AuditLog(user_id=actor.id, action="attendance.correct", entity="attendance", entity_id=rec.id, meta=f"{target_user.name} {body.date}: {before}. Reason: {body.reason}"))
    db.commit()
    db.refresh(rec)
    return to_out(rec)
