"""FastAPI application entry point."""

import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routers import factions, lists, metadata, search, units


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
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
app.include_router(lists.router)


@app.get("/api/health")
async def health() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok", "version": settings.app_version}


# Serve standalone React `dist/` compilation files natively
if os.path.isdir("dist/assets"):
    app.mount("/assets", StaticFiles(directory="dist/assets"), name="assets")

if os.path.isdir("dist/data"):
    app.mount("/data", StaticFiles(directory="dist/data"), name="data")


@app.get("/{full_path:path}", response_model=None)
async def serve_frontend(full_path: str) -> FileResponse | dict[str, Any]:
    """Fallback handler for React single-page application routing."""

    # If the file exists directly in dist/ (like favicon.ico)
    if full_path:
        dist_path = os.path.join("dist", full_path)
        if os.path.isfile(dist_path):
            return FileResponse(dist_path)

    # For all other routes, default to the index.html SPA entrypoint
    index_path = os.path.join("dist", "index.html")
    if os.path.isfile(index_path):
        return FileResponse(index_path)

    return {"error": "Production SPA files not found. Did you run `npm run build`?"}
