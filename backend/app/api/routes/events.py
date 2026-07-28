from fastapi import APIRouter, Query

from app.api.deps import AdminUser, DbDep
from app.schemas import (
    CareerEventCreate,
    CareerEventOut,
    CareerEventUpdate,
    ConflictCheck,
)
from app.services import events as event_service

router = APIRouter(prefix="/events", tags=["events"])


@router.get("", response_model=list[CareerEventOut])
def list_events(
    db: DbDep,
    includeDeleted: bool = Query(False, alias="includeDeleted"),
):
    return event_service.list_events(db, include_deleted=includeDeleted)


@router.post("/conflicts", response_model=list[CareerEventOut])
def conflicts(payload: ConflictCheck, db: DbDep):
    return event_service.find_conflicts(db, payload)


@router.get("/{event_id}", response_model=CareerEventOut)
def get_event(event_id: str, db: DbDep):
    return event_service.get_event(db, event_id)


@router.post("", response_model=CareerEventOut)
def create_event(payload: CareerEventCreate, db: DbDep, user: AdminUser):
    return event_service.create_event(db, payload, user)


@router.patch("/{event_id}", response_model=CareerEventOut)
def update_event(event_id: str, payload: CareerEventUpdate, db: DbDep, user: AdminUser):
    return event_service.update_event(db, event_id, payload, user)


@router.post("/{event_id}/duplicate", response_model=CareerEventOut)
def duplicate_event(event_id: str, db: DbDep, user: AdminUser):
    return event_service.duplicate_event(db, event_id, user)
