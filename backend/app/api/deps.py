from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from ..core.security import decode_access_token
from ..db.models import User
from ..db.session import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, "Could not validate credentials")
    payload = decode_access_token(token)
    if not payload:
        raise unauthorized
    user = db.get(User, payload.get("sub"))
    if not user or user.status != "active":
        raise unauthorized
    return user


# Mirrors the `can` map in src/lib/access.ts — keep both in sync.
CAN = {
    "manageEmployees": {"owner", "admin", "hr"},
    "assignTasks": {"owner", "admin", "lead"},
    "correctAttendance": {"owner", "admin", "hr"},
    "seeTeamAttendance": {"owner", "admin", "hr", "lead"},
    "seeAll": {"owner", "admin", "hr"},
    "approveLeave": {"owner", "admin", "hr", "lead"},
    "hrDocs": {"owner", "hr"},
    "manageProjects": {"owner", "admin", "lead"},
    "manageKpi": {"owner", "admin"},
    "moderate": {"owner", "admin"},
    "manageSettings": {"owner"},
}


def require_can(permission: str):
    allowed_roles = CAN[permission]

    def _check(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed_roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Requires one of roles: {sorted(allowed_roles)}")
        return user

    return _check
