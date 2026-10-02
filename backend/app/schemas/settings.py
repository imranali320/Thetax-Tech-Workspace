from pydantic import BaseModel


class SettingsOut(BaseModel):
    company: str
    timezone: str
    grace_mins: int
    work_hours: int
    default_break: int
    multi_break: bool
    max_file_mb: int
    file_types: str
    selfie_retention: int
    backup_time: str
    backup_keep: int

    model_config = {"from_attributes": True}


class SettingsUpdate(BaseModel):
    company: str | None = None
    timezone: str | None = None
    grace_mins: int | None = None
    work_hours: int | None = None
    default_break: int | None = None
    multi_break: bool | None = None
    max_file_mb: int | None = None
    file_types: str | None = None
    selfie_retention: int | None = None
    backup_time: str | None = None
    backup_keep: int | None = None
