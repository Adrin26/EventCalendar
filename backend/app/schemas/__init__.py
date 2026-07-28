from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field


Role = Literal["superadmin", "admin", "editor", "viewer"]
EventStatus = Literal["scheduled", "full", "completed", "cancelled", "deleted"]
EventType = Literal[
    "career-fair",
    "recruitment-drive",
    "workshop",
    "networking",
    "webinar",
]


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: Role
    created_at: str

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    token: str
    user: UserOut


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=4, max_length=128)


class CareerEventOut(BaseModel):
    id: str
    title: str
    description: str
    location: str
    state: str
    university: str
    company: str
    industry: str
    event_type: EventType
    date: str
    start_time: str
    end_time: str
    capacity: int
    registered_count: int
    status: EventStatus
    registration_url: str
    organiser: str
    created_by: str
    created_at: str
    updated_at: str
    deleted_at: str | None = None

    model_config = {"from_attributes": True}


class CareerEventCreate(BaseModel):
    title: str
    description: str = ""
    location: str = ""
    state: str = ""
    university: str = ""
    company: str = ""
    industry: str = ""
    event_type: EventType = "career-fair"
    date: str
    start_time: str = "09:00"
    end_time: str = "17:00"
    capacity: int = 100
    registration_url: str = ""
    organiser: str = ""
    created_by: str = ""


class CareerEventUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    location: str | None = None
    state: str | None = None
    university: str | None = None
    company: str | None = None
    industry: str | None = None
    event_type: EventType | None = None
    date: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    capacity: int | None = None
    registered_count: int | None = None
    status: EventStatus | None = None
    registration_url: str | None = None
    organiser: str | None = None
    deleted_at: str | None = None
    action: str | None = None


class ConflictCheck(BaseModel):
    id: str | None = None
    date: str
    start_time: str
    end_time: str
    location: str | None = None
    university: str | None = None


class AuditLogOut(BaseModel):
    id: str
    event_id: str
    event_title: str
    user_id: str
    user_name: str
    action: str
    old_value: Any | None = None
    new_value: Any | None = None
    timestamp: str

    model_config = {"from_attributes": True}


class DashboardStats(BaseModel):
    total: int
    upcoming: int
    completed: int
    cancelled: int
    this_month: int
    total_registrations: int


class DescriptionRequest(BaseModel):
    title: str
    company: str
    university: str
    industry: str
    event_type: str


class NLCommandRequest(BaseModel):
    command: str


class NLAction(BaseModel):
    op: Literal["update", "cancel", "delete", "create"]
    target_ids: list[str]
    changes: dict[str, Any] | None = None


class NLCommandPlan(BaseModel):
    intent: str
    summary: str
    actions: list[NLAction]
    affected_titles: list[str]


class ChatRequest(BaseModel):
    question: str


class ChatAnswer(BaseModel):
    answer: str
    sources: list[CareerEventOut]


def dt_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat()
