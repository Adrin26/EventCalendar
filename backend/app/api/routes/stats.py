from fastapi import APIRouter

from app.api.deps import DbDep
from app.schemas import DashboardStats
from app.services import events as event_service

router = APIRouter(tags=["stats"])


@router.get("/stats", response_model=DashboardStats)
def get_stats(db: DbDep):
    return event_service.stats(db)
