"""Pydantic schemas for API responses — faction-related endpoints."""

from pydantic import BaseModel


class FactionSummary(BaseModel):
    """Lightweight faction info for list views."""
    id: int
    name: str
    slug: str
    parent_id: int | None
    is_vanilla: bool
    discontinued: bool
    logo: str

    model_config = {"from_attributes": True}


class SuperFactionResponse(BaseModel):
    """Grouped faction: a super-faction with its sectorials."""
    id: int
    name: str
    vanilla: FactionSummary | None
    sectorials: list[FactionSummary]


class FactionDetailResponse(FactionSummary):
    """Full faction detail including fireteam chart."""
    fireteam_chart: dict | None = None
    unit_count: int = 0
