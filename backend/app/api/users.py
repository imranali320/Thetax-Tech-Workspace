from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..core.security import hash_password
from ..db.models import AuditLog, User
from ..db.session import get_db
from ..schemas.user import UserCreate, UserOut, UserUpdate
from .deps import get_current_user, require_can

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    # Every active account can read the basic directory (names/avatars/roles are
    # needed throughout the app — chat, task assignees, mentions); only
    # manageEmployees roles can create/edit, enforced below.
    return db.scalars(select(User)).all()


@router.post("", response_model=UserOut)
def create_user(body: UserCreate, db: Session = Depends(get_db), actor: User = Depends(require_can("manageEmployees"))):
    if db.scalar(select(User).where(User.email == body.email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already in use")
    user = User(
        emp_id=body.emp_id,
        name=body.name,
        email=body.email,
        phone=body.phone,
        role=body.role,
        dept=body.dept,
        title=body.title,
        manager_id=body.manager_id,
        shift=body.shift,
        break_mins=body.break_mins,
        hashed_password=hash_password(body.temp_password),
        must_change=True,
    )
    db.add(user)
    db.add(AuditLog(user_id=actor.id, action="create", entity="user", entity_id=user.id, meta=user.email))
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: str, body: UserUpdate, db: Session = Depends(get_db), actor: User = Depends(require_can("manageEmployees"))):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    changes = body.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(user, field, value)
    if changes:
        db.add(AuditLog(user_id=actor.id, action="update", entity="user", entity_id=user.id, meta=str(changes)))
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: str, db: Session = Depends(get_db), actor: User = Depends(require_can("manageEmployees"))):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if user.id == actor.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You can't delete your own account")
    if user.role == "owner" and db.scalar(select(User).where(User.role == "owner", User.id != user.id)) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Can't delete the last owner account")

    name, email = user.name, user.email
    db.delete(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This employee has attendance, files or other records attached — disable the account instead of deleting it.",
        )
    db.add(AuditLog(user_id=actor.id, action="delete", entity="user", entity_id=user_id, meta=f"{name} ({email})"))
    db.commit()
