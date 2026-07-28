from fastapi import APIRouter

from app.api.deps import DbDep
from app.schemas import AuthResponse, LoginRequest, SignupRequest
from app.services import events as event_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=AuthResponse)
def signup(payload: SignupRequest, db: DbDep):
    return event_service.signup(db, payload)


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: DbDep):
    return event_service.login(db, payload)
