from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db.models import CompanySettings, User
from ..db.session import get_db
from ..schemas.settings import SettingsOut, SettingsUpdate
from .deps import get_current_user, require_can

router = APIRouter(prefix="/settings", tags=["settings"])


def get_or_create(db: Session) -> CompanySettings:
    s = db.get(CompanySettings, "main")
    if not s:
        s = CompanySettings(id="main")
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


@router.get("", response_model=SettingsOut)
def get_settings(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return get_or_create(db)


@router.patch("", response_model=SettingsOut)
def update_settings(body: SettingsUpdate, db: Session = Depends(get_db), _: User = Depends(require_can("manageSettings"))):
    s = get_or_create(db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(s, field, value)
    db.commit()
    db.refresh(s)
    return s
