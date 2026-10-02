from pydantic import BaseModel


class DepartmentOut(BaseModel):
    id: str
    name: str
    manager_id: str | None

    model_config = {"from_attributes": True}


class DepartmentCreate(BaseModel):
    name: str
    manager_id: str | None = None
