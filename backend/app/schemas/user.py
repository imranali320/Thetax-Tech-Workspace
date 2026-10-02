from datetime import date

from pydantic import BaseModel, EmailStr

from ..db.models import ROLES


class UserOut(BaseModel):
    id: str
    emp_id: str
    name: str
    email: EmailStr
    phone: str
    role: str
    dept: str | None
    title: str
    manager_id: str | None
    shift: str
    break_mins: int
    joined: date
    status: str
    presence: str
    must_change: bool

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    emp_id: str
    name: str
    email: EmailStr
    phone: str = ""
    role: str
    dept: str | None = None
    title: str = ""
    manager_id: str | None = None
    shift: str = "09:00"
    break_mins: int = 30
    temp_password: str


class UserUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    role: str | None = None
    dept: str | None = None
    title: str | None = None
    manager_id: str | None = None
    shift: str | None = None
    break_mins: int | None = None
    status: str | None = None


def validate_role(role: str) -> str:
    if role not in ROLES:
        raise ValueError(f"role must be one of {ROLES}")
    return role
