"""FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import factions, units, search, metadata


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    # Startup: nothing needed — DB connections are lazy via get_session
    yield
    # Shutdown: dispose engine
    from app.database import engine
    await engine.dispose()


app = FastAPI(
    title=settings.app_title,
    version=settings.app_version,
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(factions.router)
app.include_router(units.router)
app.include_router(search.router)
app.include_router(metadata.router)


@app.get("/api/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "version": settings.app_version}
