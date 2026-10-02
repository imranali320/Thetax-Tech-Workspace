from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.security import create_access_token, hash_password, verify_password
from ..db.models import AuditLog, User
from ..db.session import get_db
from ..schemas.auth import ChangePasswordRequest, LoginRequest, TokenResponse
from ..schemas.user import UserOut
from .deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


def _log(db: Session, user_id: str | None, action: str, entity: str, entity_id: str = "", meta: str = ""):
    db.add(AuditLog(user_id=user_id, action=action, entity=entity, entity_id=entity_id, meta=meta))


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email))
    if not user or not verify_password(body.password, user.hashed_password):
        if user:
            _log(db, user.id, "login_failed", "user", user.id)
            db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if user.status != "active":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is disabled")

    token = create_access_token(subject=user.id, role=user.role)
    user.presence = "online"
    _log(db, user.id, "login", "user", user.id)
    db.commit()
    db.refresh(user)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/logout")
def logout(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.presence = "offline"
    _log(db, user.id, "logout", "user", user.id)
    db.commit()
    return {"ok": True}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/change-password")
def change_password(body: ChangePasswordRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    user.hashed_password = hash_password(body.new_password)
    user.must_change = False
    _log(db, user.id, "password_change", "user", user.id)
    db.commit()
    return {"ok": True}
