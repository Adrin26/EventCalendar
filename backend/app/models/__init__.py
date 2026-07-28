import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _uid() -> str:
    return uuid.uuid4().hex[:12]


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(32), default="viewer")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class CareerEvent(Base):
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    location: Mapped[str] = mapped_column(String(255), default="")
    state: Mapped[str] = mapped_column(String(120), default="")
    university: Mapped[str] = mapped_column(String(255), default="")
    company: Mapped[str] = mapped_column(String(255), default="")
    industry: Mapped[str] = mapped_column(String(120), default="")
    event_type: Mapped[str] = mapped_column(String(64), default="career-fair")
    date: Mapped[str] = mapped_column(String(10), index=True)  # YYYY-MM-DD
    start_time: Mapped[str] = mapped_column(String(5), default="09:00")
    end_time: Mapped[str] = mapped_column(String(5), default="17:00")
    capacity: Mapped[int] = mapped_column(Integer, default=100)
    registered_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(32), default="scheduled", index=True)
    registration_url: Mapped[str] = mapped_column(String(512), default="")
    organiser: Mapped[str] = mapped_column(String(255), default="")
    created_by: Mapped[str] = mapped_column(String(32), default="system")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    event_id: Mapped[str] = mapped_column(String(32), index=True)
    event_title: Mapped[str] = mapped_column(String(255), default="")
    user_id: Mapped[str] = mapped_column(String(32), default="")
    user_name: Mapped[str] = mapped_column(String(120), default="")
    action: Mapped[str] = mapped_column(String(64))
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
