import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import attendance, auth, chat, departments, files, settings as settings_api, users
from .core.config import settings

os.makedirs(settings.storage_dir, exist_ok=True)
os.makedirs(settings.selfie_dir, exist_ok=True)

app = FastAPI(title="Theta Workplace API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(departments.router)
app.include_router(files.router)
app.include_router(attendance.router)
app.include_router(settings_api.router)
app.include_router(chat.router)


@app.get("/health")
def health():
    return {"status": "ok"}
