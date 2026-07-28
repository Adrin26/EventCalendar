from fastapi import APIRouter

from app.api.routes import ai, audit, auth, events, stats

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(events.router)
api_router.include_router(stats.router)
api_router.include_router(audit.router)
api_router.include_router(ai.router)
