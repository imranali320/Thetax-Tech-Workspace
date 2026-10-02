from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db.models import Department, User
from ..db.session import get_db
from ..schemas.department import DepartmentCreate, DepartmentOut
from .deps import get_current_user, require_can

router = APIRouter(prefix="/departments", tags=["departments"])


@router.get("", response_model=list[DepartmentOut])
def list_departments(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.scalars(select(Department)).all()


@router.post("", response_model=DepartmentOut)
def create_department(body: DepartmentCreate, db: Session = Depends(get_db), _: User = Depends(require_can("manageEmployees"))):
    dept = Department(name=body.name, manager_id=body.manager_id)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept
