from pydantic import BaseModel


class BreakOut(BaseModel):
    id: str
    start: int
    end: int | None


class CorrectionOut(BaseModel):
    at: int
    by: str
    reason: str
    before: str


class EventOut(BaseModel):
    type: str
    at: int


class AttendanceOut(BaseModel):
    id: str
    user_id: str
    date: str
    check_in: int | None
    check_out: int | None
    late: bool
    selfie: str | None
    breaks: list[BreakOut]
    corrections: list[CorrectionOut]
    events: list[EventOut]


class CheckInIn(BaseModel):
    selfie: str | None = None


class CorrectionIn(BaseModel):
    user_id: str
    date: str
    check_in: str | None = None  # "HH:MM"
    check_out: str | None = None
    reason: str
