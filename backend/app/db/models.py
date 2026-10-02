import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


def new_id() -> str:
    return uuid.uuid4().hex


# Matches the Role union in src/types.ts and the role matrix in src/lib/access.ts
ROLES = ("owner", "admin", "hr", "lead", "employee", "accountant")


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    manager_id: Mapped[str | None] = mapped_column(String(32), ForeignKey("users.id"), nullable=True)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    emp_id: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(190), unique=True, nullable=False)
    phone: Mapped[str] = mapped_column(String(32), default="")
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    dept: Mapped[str | None] = mapped_column(String(32), ForeignKey("departments.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(120), default="")
    manager_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    shift: Mapped[str] = mapped_column(String(8), default="09:00")
    break_mins: Mapped[int] = mapped_column(Integer, default=30)
    joined: Mapped[date] = mapped_column(Date, default=date.today)
    status: Mapped[str] = mapped_column(String(16), default="active")  # active | disabled
    presence: Mapped[str] = mapped_column(String(16), default="offline")  # online | away | offline
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    must_change: Mapped[bool] = mapped_column(Boolean, default=True)

    department = relationship("Department", foreign_keys=[dept])


class FileRecord(Base):
    __tablename__ = "files"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(120), default="application/octet-stream")
    owner_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), nullable=False)
    folder_dept: Mapped[str | None] = mapped_column(String(32), ForeignKey("departments.id"), nullable=True)
    folder_project: Mapped[str | None] = mapped_column(String(64), nullable=True)
    folder_employee: Mapped[str | None] = mapped_column(String(32), ForeignKey("users.id"), nullable=True)
    visibility: Mapped[str] = mapped_column(String(16), default="company")  # company|department|project|private|hr
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    versions = relationship("FileVersion", back_populates="file", order_by="FileVersion.version", cascade="all, delete-orphan")


class FileVersion(Base):
    __tablename__ = "file_versions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    file_id: Mapped[str] = mapped_column(String(32), ForeignKey("files.id"), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    stored_name: Mapped[str] = mapped_column(String(255), nullable=False)
    size: Mapped[int] = mapped_column(Integer, nullable=False)
    uploaded_by: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    file = relationship("FileRecord", back_populates="versions")


class CompanySettings(Base):
    __tablename__ = "settings"

    id: Mapped[str] = mapped_column(String(16), primary_key=True, default="main")
    company: Mapped[str] = mapped_column(String(120), default="Theta X Tech")
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Karachi")
    grace_mins: Mapped[int] = mapped_column(Integer, default=10)
    work_hours: Mapped[int] = mapped_column(Integer, default=8)
    default_break: Mapped[int] = mapped_column(Integer, default=30)
    multi_break: Mapped[bool] = mapped_column(Boolean, default=False)
    max_file_mb: Mapped[int] = mapped_column(Integer, default=20)
    file_types: Mapped[str] = mapped_column(String(255), default="pdf,doc,docx,xls,xlsx,ppt,pptx,jpg,jpeg,png")
    selfie_retention: Mapped[int] = mapped_column(Integer, default=90)
    backup_time: Mapped[str] = mapped_column(String(8), default="02:00")
    backup_keep: Mapped[int] = mapped_column(Integer, default=14)


class Attendance(Base):
    __tablename__ = "attendance"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), nullable=False)
    date: Mapped[str] = mapped_column(String(10), nullable=False)  # YYYY-MM-DD
    check_in: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    check_out: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    late: Mapped[bool] = mapped_column(Boolean, default=False)
    selfie_path: Mapped[str | None] = mapped_column(String(255), nullable=True)

    breaks = relationship("AttendanceBreak", back_populates="attendance", order_by="AttendanceBreak.start_time", cascade="all, delete-orphan")
    corrections = relationship("AttendanceCorrection", back_populates="attendance", order_by="AttendanceCorrection.at", cascade="all, delete-orphan")


class AttendanceBreak(Base):
    __tablename__ = "attendance_breaks"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    attendance_id: Mapped[str] = mapped_column(String(32), ForeignKey("attendance.id"), nullable=False)
    start_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    end_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    attendance = relationship("Attendance", back_populates="breaks")


class AttendanceCorrection(Base):
    __tablename__ = "attendance_corrections"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    attendance_id: Mapped[str] = mapped_column(String(32), ForeignKey("attendance.id"), nullable=False)
    by_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    before: Mapped[str] = mapped_column(String(255), default="")
    at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    attendance = relationship("Attendance", back_populates="corrections")


class Channel(Base):
    __tablename__ = "channels"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(120), default="")
    type: Mapped[str] = mapped_column(String(16), default="channel")  # channel | project | dm
    project_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    topic: Mapped[str] = mapped_column(String(255), default="")

    members = relationship("ChannelMember", back_populates="channel", cascade="all, delete-orphan")


class ChannelMember(Base):
    __tablename__ = "channel_members"

    channel_id: Mapped[str] = mapped_column(String(32), ForeignKey("channels.id"), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), primary_key=True)

    channel = relationship("Channel", back_populates="members")


class ChannelRead(Base):
    __tablename__ = "channel_reads"

    channel_id: Mapped[str] = mapped_column(String(32), ForeignKey("channels.id"), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), primary_key=True)
    at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    channel_id: Mapped[str] = mapped_column(String(32), ForeignKey("channels.id"), nullable=False)
    sender_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    text: Mapped[str] = mapped_column(Text, default="")
    at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    parent_id: Mapped[str | None] = mapped_column(String(32), ForeignKey("messages.id"), nullable=True)
    edited: Mapped[bool] = mapped_column(Boolean, default=False)
    attachment_file_id: Mapped[str | None] = mapped_column(String(32), ForeignKey("files.id"), nullable=True)

    reactions = relationship("MessageReaction", back_populates="message", cascade="all, delete-orphan")


class MessageReaction(Base):
    __tablename__ = "message_reactions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    message_id: Mapped[str] = mapped_column(String(32), ForeignKey("messages.id"), nullable=False)
    emoji: Mapped[str] = mapped_column(String(8), nullable=False)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), nullable=False)

    message = relationship("Message", back_populates="reactions")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    user_id: Mapped[str | None] = mapped_column(String(32), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    entity: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(64), default="")
    meta: Mapped[str] = mapped_column(Text, default="")
