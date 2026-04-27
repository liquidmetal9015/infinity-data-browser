from datetime import datetime
from pydantic import BaseModel, Field


class ArmyListBase(BaseModel):
    name: str = Field(..., max_length=255)
    faction_id: int
    points: int = 0
    swc: float = 0.0
    units_json: dict = Field(default_factory=dict, description="JSON payload representing the list composition")


class ArmyListCreate(ArmyListBase):
    pass


class ArmyListUpdate(ArmyListBase):
    name: str | None = Field(None, max_length=255)
    faction_id: int | None = None
    points: int | None = None
    swc: float | None = None
    units_json: dict | None = None


class ArmyListSummaryResponse(BaseModel):
    id: int
    name: str
    faction_id: int
    points: int
    swc: float
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ArmyListDetailResponse(ArmyListSummaryResponse):
    units_json: dict
    
    class Config:
        from_attributes = True
