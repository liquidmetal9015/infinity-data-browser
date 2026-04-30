from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ArmyListBase(BaseModel):
    name: str = Field(..., max_length=255)
    description: str | None = None
    tags: list[str] = Field(default_factory=list)
    faction_id: int
    points: int = 0
    swc: float = 0.0
    units_json: dict[str, Any] = Field(
        default_factory=dict,
        description="JSON payload representing the list composition",
    )


class ArmyListCreate(ArmyListBase):
    pass


class ArmyListUpdate(BaseModel):
    name: str | None = Field(None, max_length=255)
    description: str | None = None
    tags: list[str] | None = None
    faction_id: int | None = None
    points: int | None = None
    swc: float | None = None
    units_json: dict[str, Any] | None = None


class ArmyListSummaryResponse(BaseModel):
    id: int
    name: str
    description: str | None
    tags: list[str]
    faction_id: int
    points: int
    swc: float
    unit_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ArmyListDetailResponse(ArmyListSummaryResponse):
    units_json: dict[str, Any]

    class Config:
        from_attributes = True
