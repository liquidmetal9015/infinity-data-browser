"""SQLAlchemy async engine and session factory.

Used by Alembic migrations and `app/etl/import_json.py`. The runtime API is
in `backend-ts/`; this module is intentionally minimal.
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_pre_ping=True,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)
