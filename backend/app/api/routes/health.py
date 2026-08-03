from fastapi import APIRouter
from sqlalchemy import text

from app.core.config import get_settings
from app.db import SessionLocal
from app.schemas import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    settings = get_settings()
    database_status = "ok"

    try:
        with SessionLocal() as session:
            session.execute(text("SELECT 1"))
    except Exception:
        database_status = "error"

    return HealthResponse(
        status="ok",
        environment=settings.app_env,
        database=database_status,
    )
