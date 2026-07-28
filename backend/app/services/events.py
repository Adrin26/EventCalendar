import json
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.models import AuditLog, CareerEvent, User
from app.schemas import (
    AuthResponse,
    CareerEventCreate,
    CareerEventOut,
    CareerEventUpdate,
    ConflictCheck,
    DashboardStats,
    LoginRequest,
    SignupRequest,
    UserOut,
    dt_iso,
)


def _user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,  # type: ignore[arg-type]
        created_at=dt_iso(user.created_at) or "",
    )


def _event_out(ev: CareerEvent) -> CareerEventOut:
    return CareerEventOut(
        id=ev.id,
        title=ev.title,
        description=ev.description,
        location=ev.location,
        state=ev.state,
        university=ev.university,
        company=ev.company,
        industry=ev.industry,
        event_type=ev.event_type,  # type: ignore[arg-type]
        date=ev.date,
        start_time=ev.start_time,
        end_time=ev.end_time,
        capacity=ev.capacity,
        registered_count=ev.registered_count,
        status=ev.status,  # type: ignore[arg-type]
        registration_url=ev.registration_url,
        organiser=ev.organiser,
        created_by=ev.created_by,
        created_at=dt_iso(ev.created_at) or "",
        updated_at=dt_iso(ev.updated_at) or "",
        deleted_at=dt_iso(ev.deleted_at),
    )


def _recompute_status(ev: CareerEvent) -> None:
    if ev.status in ("cancelled", "deleted"):
        return
    today = datetime.now(timezone.utc).date().isoformat()
    if ev.date < today:
        ev.status = "completed"
    elif ev.registered_count >= ev.capacity:
        ev.status = "full"
    else:
        ev.status = "scheduled"


def _log(
    db: Session,
    ev: CareerEvent,
    user: User | None,
    action: str,
    old: dict | None,
    new: dict | None,
) -> None:
    db.add(
        AuditLog(
            event_id=ev.id,
            event_title=ev.title,
            user_id=user.id if user else "",
            user_name=user.name if user else "system",
            action=action,
            old_value=json.dumps(old) if old is not None else None,
            new_value=json.dumps(new) if new is not None else None,
        )
    )


def signup(db: Session, payload: SignupRequest) -> AuthResponse:
    if db.query(User).filter(User.email == payload.email.lower()).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email already registered")
    role = "superadmin" if db.query(User).count() == 0 else "viewer"
    user = User(
        name=payload.name,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return AuthResponse(token=create_access_token(user.id), user=_user_out(user))


def login(db: Session, payload: LoginRequest) -> AuthResponse:
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    return AuthResponse(token=create_access_token(user.id), user=_user_out(user))


def list_events(db: Session, include_deleted: bool = False) -> list[CareerEventOut]:
    q = db.query(CareerEvent)
    events = q.all()
    changed = False
    for ev in events:
        before = ev.status
        _recompute_status(ev)
        if ev.status != before:
            changed = True
    if changed:
        db.commit()
    if not include_deleted:
        events = [e for e in events if e.status != "deleted"]
    return [_event_out(e) for e in events]


def get_event(db: Session, event_id: str) -> CareerEventOut:
    ev = db.get(CareerEvent, event_id)
    if not ev:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    return _event_out(ev)


def create_event(db: Session, payload: CareerEventCreate, user: User | None) -> CareerEventOut:
    ev = CareerEvent(
        **payload.model_dump(exclude={"created_by"}),
        created_by=user.id if user else (payload.created_by or "system"),
        registered_count=0,
        status="scheduled",
    )
    db.add(ev)
    db.flush()
    _log(db, ev, user, "created", None, _event_out(ev).model_dump())
    db.commit()
    db.refresh(ev)
    return _event_out(ev)


def update_event(
    db: Session,
    event_id: str,
    payload: CareerEventUpdate,
    user: User | None,
) -> CareerEventOut:
    ev = db.get(CareerEvent, event_id)
    if not ev:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    old = _event_out(ev).model_dump()
    data = payload.model_dump(exclude_unset=True, exclude={"action"})
    action = payload.action or "updated"

    if "deleted_at" in data:
        raw = data.pop("deleted_at")
        if raw is None:
            ev.deleted_at = None
        else:
            try:
                ev.deleted_at = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            except ValueError:
                ev.deleted_at = datetime.now(timezone.utc)

    for key, value in data.items():
        setattr(ev, key, value)

    ev.updated_at = datetime.now(timezone.utc)
    _log(db, ev, user, action, old, _event_out(ev).model_dump())
    db.commit()
    db.refresh(ev)
    return _event_out(ev)


def duplicate_event(db: Session, event_id: str, user: User | None) -> CareerEventOut:
    src = db.get(CareerEvent, event_id)
    if not src:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    payload = CareerEventCreate(
        title=f"{src.title} (Copy)",
        description=src.description,
        location=src.location,
        state=src.state,
        university=src.university,
        company=src.company,
        industry=src.industry,
        event_type=src.event_type,  # type: ignore[arg-type]
        date=src.date,
        start_time=src.start_time,
        end_time=src.end_time,
        capacity=src.capacity,
        registration_url=src.registration_url,
        organiser=src.organiser,
    )
    return create_event(db, payload, user)


def find_conflicts(db: Session, payload: ConflictCheck) -> list[CareerEventOut]:
    events = [
        e
        for e in db.query(CareerEvent).filter(CareerEvent.date == payload.date).all()
        if e.status not in ("cancelled", "deleted")
    ]
    conflicts: list[CareerEvent] = []
    for e in events:
        if payload.id and e.id == payload.id:
            continue
        overlap = payload.start_time < e.end_time and payload.end_time > e.start_time
        if not overlap:
            continue
        same_venue = payload.location and e.location == payload.location
        same_uni = payload.university and e.university == payload.university
        if same_venue or same_uni:
            conflicts.append(e)
    return [_event_out(e) for e in conflicts]


def stats(db: Session) -> DashboardStats:
    events = [e for e in db.query(CareerEvent).all() if e.status != "deleted"]
    today = datetime.now(timezone.utc).date().isoformat()
    month = today[:7]
    return DashboardStats(
        total=len(events),
        upcoming=sum(1 for e in events if e.date >= today and e.status != "cancelled"),
        completed=sum(1 for e in events if e.status == "completed"),
        cancelled=sum(1 for e in events if e.status == "cancelled"),
        this_month=sum(1 for e in events if e.date.startswith(month)),
        total_registrations=sum(e.registered_count for e in events),
    )


def audit_logs(db: Session) -> list[dict]:
    rows = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(200).all()
    out = []
    for r in rows:
        old = json.loads(r.old_value) if r.old_value else None
        new = json.loads(r.new_value) if r.new_value else None
        out.append(
            {
                "id": r.id,
                "event_id": r.event_id,
                "event_title": r.event_title,
                "user_id": r.user_id,
                "user_name": r.user_name,
                "action": r.action,
                "old_value": old,
                "new_value": new,
                "timestamp": dt_iso(r.timestamp) or "",
            }
        )
    return out


def search_events(db: Session, query: str, limit: int = 6) -> list[CareerEventOut]:
    q = query.lower()
    events = [e for e in db.query(CareerEvent).all() if e.status != "deleted"]
    matched = []
    for e in events:
        blob = " ".join(
            [
                e.title,
                e.description,
                e.company,
                e.university,
                e.state,
                e.location,
                e.industry,
                e.event_type,
            ]
        ).lower()
        if q in blob or any(tok in blob for tok in q.split() if len(tok) > 2):
            matched.append(e)
        if len(matched) >= limit:
            break
    return [_event_out(e) for e in matched]
