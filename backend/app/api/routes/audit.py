from fastapi import APIRouter

from app.api.deps import AdminUser, DbDep
from app.services import events as event_service

router = APIRouter(tags=["audit"])


@router.get("/audit")
def get_audit(db: DbDep, _user: AdminUser):
    return event_service.audit_logs(db)
