"""Metadata API route — item catalogs (weapons, skills, equipment, ammo)."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_session
from app.models.item import Weapon, Skill, Equipment, Ammunition

router = APIRouter(prefix="/api/metadata", tags=["metadata"])


class WeaponResponse(BaseModel):
    id: int
    name: str
    weapon_type: str | None = None
    burst: str | None = None
    damage: str | None = None
    saving: str | None = None
    saving_num: str | None = None
    properties: list[str] = []
    distance: dict | None = None
    wiki_url: str | None = None

    model_config = {"from_attributes": True}


class SkillResponse(BaseModel):
    id: int
    name: str
    wiki_url: str | None = None

    model_config = {"from_attributes": True}


class EquipmentResponse(BaseModel):
    id: int
    name: str
    wiki_url: str | None = None

    model_config = {"from_attributes": True}


class AmmunitionResponse(BaseModel):
    id: int
    name: str
    wiki_url: str | None = None

    model_config = {"from_attributes": True}


class MetadataResponse(BaseModel):
    weapons: list[WeaponResponse]
    skills: list[SkillResponse]
    equipment: list[EquipmentResponse]
    ammunitions: list[AmmunitionResponse]


@router.get("", response_model=MetadataResponse)
async def get_metadata(session: AsyncSession = Depends(get_session)):
    """Get all item catalogs (weapons, skills, equipment, ammunition)."""
    weapons = (await session.execute(select(Weapon).order_by(Weapon.name))).scalars().all()
    skills = (await session.execute(select(Skill).order_by(Skill.name))).scalars().all()
    equips = (await session.execute(select(Equipment).order_by(Equipment.name))).scalars().all()
    ammos = (await session.execute(select(Ammunition).order_by(Ammunition.name))).scalars().all()

    return MetadataResponse(
        weapons=[WeaponResponse.model_validate(w) for w in weapons],
        skills=[SkillResponse.model_validate(s) for s in skills],
        equipment=[EquipmentResponse.model_validate(e) for e in equips],
        ammunitions=[AmmunitionResponse.model_validate(a) for a in ammos],
    )
