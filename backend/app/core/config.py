from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    secret_key: str
    access_token_expire_minutes: int = 480
    frontend_origins: str = "http://localhost:5173"
    storage_dir: str = "storage/files"
    selfie_dir: str = "storage/selfies"
    max_file_mb: int = 20
    allowed_extensions: str = "pdf,doc,docx,xls,xlsx,ppt,pptx,jpg,jpeg,png"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def allowed_ext_set(self) -> set[str]:
        return {e.strip().lower() for e in self.allowed_extensions.split(",") if e.strip()}

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.frontend_origins.split(",") if o.strip()]


settings = Settings()
