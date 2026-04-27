"""Pydantic schemas for search endpoint."""

from pydantic import BaseModel


class SearchParams(BaseModel):
    """Query parameters for unit search."""
    q: str | None = None
    faction: str | None = None
    has_weapon: str | None = None
    has_skill: str | None = None
    has_equipment: str | None = None
    min_points: int | None = None
    max_points: int | None = None
    limit: int = 50
    offset: int = 0
