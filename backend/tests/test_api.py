"""Smoke tests for the API endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    """Health endpoint returns 200."""
    response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


@pytest.mark.asyncio
async def test_factions_empty(client: AsyncClient):
    """Factions endpoint returns empty list when no data."""
    response = await client.get("/api/factions")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_unit_not_found(client: AsyncClient):
    """Unit detail returns 404 for non-existent slug."""
    response = await client.get("/api/units/nonexistent")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_metadata_empty(client: AsyncClient):
    """Metadata endpoint returns empty catalogs when no data."""
    response = await client.get("/api/metadata")
    assert response.status_code == 200
    data = response.json()
    assert data["weapons"] == []
    assert data["skills"] == []
