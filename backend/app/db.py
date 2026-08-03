from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.models import Base

settings = get_settings()

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_all_tables() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_schema_compatibility()


def ensure_schema_compatibility() -> None:
    if not settings.database_url.startswith("sqlite"):
        return

    statements = [
        (
            "context_packages",
            "current_version",
            "ALTER TABLE context_packages ADD COLUMN current_version INTEGER DEFAULT 1",
        ),
    ]

    with engine.begin() as connection:
        for table_name, column_name, statement in statements:
            try:
                columns = {
                    row[1]
                    for row in connection.execute(text(f"PRAGMA table_info({table_name})"))
                }
            except Exception:
                continue

            if column_name not in columns:
                connection.execute(text(statement))
