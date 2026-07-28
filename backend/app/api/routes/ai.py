from fastapi import APIRouter

from app.api.deps import AdminUser, DbDep
from app.schemas import (
    ChatAnswer,
    ChatRequest,
    DescriptionRequest,
    NLCommandPlan,
    NLCommandRequest,
)
from app.services import ai as ai_service

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/description")
def description(payload: DescriptionRequest):
    return {"description": ai_service.generate_description(payload)}


@router.post("/nl-command", response_model=NLCommandPlan)
def nl_command(payload: NLCommandRequest, db: DbDep, _user: AdminUser):
    return ai_service.plan_nl_command(db, payload.command)


@router.post("/chat", response_model=ChatAnswer)
def chat(payload: ChatRequest, db: DbDep):
    return ai_service.rag_chat(db, payload.question)


@router.get("/analytics")
def analytics(db: DbDep, _user: AdminUser):
    return ai_service.ai_analytics(db)
