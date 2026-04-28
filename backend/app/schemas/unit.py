"""Pydantic schemas for API responses — unit-related endpoints."""

from pydantic import BaseModel


class ItemRef(BaseModel):
    """A reference to a weapon/skill/equipment with optional modifiers."""

    id: int
    name: str
    extra: list[int] = []
    extra_display: list[str] = []


class ProfileResponse(BaseModel):
    """Unit stat line."""

    id: int
    profile_group_id: int
    name: str
    mov: str  # Formatted "4-4"
    cc: int
    bs: int
    ph: int
    wip: int
    arm: int
    bts: int
    wounds: int
    silhouette: int
    is_structure: bool
    unit_type: int | None = None
    skills: list[ItemRef] = []
    equipment: list[ItemRef] = []
    weapons: list[ItemRef] = []

    model_config = {"from_attributes": True}


class LoadoutResponse(BaseModel):
    """Equipment option / variant."""

    id: int
    option_id: int
    profile_group_id: int
    name: str
    points: int
    swc: float
    skills: list[ItemRef] = []
    equipment: list[ItemRef] = []
    weapons: list[ItemRef] = []

    model_config = {"from_attributes": True}


class UnitSummaryResponse(BaseModel):
    """Lightweight unit info for list / search views."""

    id: int
    isc: str
    name: str
    slug: str
    factions: list[str]  # Faction slugs
    points_min: int
    points_max: int

    model_config = {"from_attributes": True}


class UnitDetailResponse(BaseModel):
    """Full unit detail with profiles and loadouts."""

    id: int
    isc: str
    name: str
    slug: str
    factions: list[str]
    profiles: list[ProfileResponse]
    loadouts: list[LoadoutResponse]

    model_config = {"from_attributes": True}
