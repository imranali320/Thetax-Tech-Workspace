"""Create tables and the first owner account. Run once: python bootstrap.py

Reads OWNER_EMAIL / OWNER_NAME / OWNER_PASSWORD from the environment so this works
non-interactively (scripts, CI, this chat's sandbox); falls back to demo values if unset.
"""
import os

from app.core.security import hash_password
from app.db.base import Base
from app.db.models import User
from app.db.session import SessionLocal, engine

Base.metadata.create_all(bind=engine)

db = SessionLocal()
try:
    if not db.query(User).filter_by(role="owner").first():
        email = os.environ.get("OWNER_EMAIL", "owner@thetax.test").strip()
        name = os.environ.get("OWNER_NAME", "Owner Admin").strip()
        password = os.environ.get("OWNER_PASSWORD", "demo12345")
        owner = User(
            emp_id="EMP-0001",
            name=name,
            email=email,
            role="owner",
            hashed_password=hash_password(password),
            must_change=False,
        )
        db.add(owner)
        db.commit()
        print(f"Owner account created: {email}")
    else:
        print("An owner account already exists — skipping.")
finally:
    db.close()
