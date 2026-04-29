"""Unit API routes."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_session
from app.models.faction import Faction
from app.models.item import Equipment, Skill, Weapon
from app.models.unit import Loadout, Profile, Unit
from app.schemas.unit import (
    ItemRef,
    LoadoutResponse,
    ProfileResponse,
    UnitDetailResponse,
    UnitSummaryResponse,
)

router = APIRouter(prefix="/api/units", tags=["units"])


def _resolve_items(
    items_json: list[dict[str, Any]],
    catalog: dict[int, str],
    extras_map: dict[int, str] | None = None,
) -> list[ItemRef]:
    """Resolve JSONB item references to ItemRef with names."""
    result = []
    for item in items_json:
        item_id = item.get("id", 0)
        name = catalog.get(item_id, f"Unknown ({item_id})")
        extra = item.get("extra", [])
        extra_display = []
        if extras_map and extra:
            extra_display = [extras_map.get(e, str(e)) for e in extra]
        result.append(
            ItemRef(id=item_id, name=name, extra=extra, extra_display=extra_display)
        )
    return result


async def _get_catalogs(
    session: AsyncSession,
) -> tuple[dict[int, str], dict[int, str], dict[int, str], dict[int, str]]:
    """Load item catalogs for name resolution."""
    weapons = {w.id: w.name for w in (await session.execute(select(Weapon))).scalars()}
    skills = {s.id: s.name for s in (await session.execute(select(Skill))).scalars()}
    equips = {
        e.id: e.name for e in (await session.execute(select(Equipment))).scalars()
    }
    # TODO: load extras_map from a dedicated table or cache
    return weapons, skills, equips, {}


def _build_profile_response(
    p: Profile,
    weapon_map: dict[int, str],
    skill_map: dict[int, str],
    equip_map: dict[int, str],
    extras_map: dict[int, str],
) -> ProfileResponse:
    return ProfileResponse(
        id=p.id,
        profile_group_id=p.profile_group_id,
        name=p.name,
        mov=f"{p.mov_1}-{p.mov_2}",
        cc=p.cc,
        bs=p.bs,
        ph=p.ph,
        wip=p.wip,
        arm=p.arm,
        bts=p.bts,
        wounds=p.wounds,
        silhouette=p.silhouette,
        is_structure=p.is_structure,
        unit_type=p.unit_type,
        skills=_resolve_items(p.skills_json or [], skill_map, extras_map),
        equipment=_resolve_items(p.equipment_json or [], equip_map, extras_map),
        weapons=_resolve_items(p.weapons_json or [], weapon_map, extras_map),
    )


def _build_loadout_response(
    lo: Loadout,
    weapon_map: dict[int, str],
    skill_map: dict[int, str],
    equip_map: dict[int, str],
    extras_map: dict[int, str],
) -> LoadoutResponse:
    return LoadoutResponse(
        id=lo.id,
        option_id=lo.option_id,
        profile_group_id=lo.profile_group_id,
        name=lo.name,
        points=lo.points,
        swc=lo.swc,
        skills=_resolve_items(lo.skills_json or [], skill_map, extras_map),
        equipment=_resolve_items(lo.equipment_json or [], equip_map, extras_map),
        weapons=_resolve_items(lo.weapons_json or [], weapon_map, extras_map),
    )


@router.get("", response_model=list[UnitSummaryResponse])
async def list_units(
    faction: str | None = Query(None, description="Filter by faction slug"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
) -> list[UnitSummaryResponse]:
    """List units with optional faction filter."""
    query = select(Unit).options(
        selectinload(Unit.factions), selectinload(Unit.loadouts)
    )

    if faction:
        query = query.join(Unit.factions).where(Faction.slug == faction)

    query = query.order_by(Unit.name).limit(limit).offset(offset)
    result = await session.execute(query)
    units = result.scalars().unique().all()

    return [
        UnitSummaryResponse(
            id=u.id,
            isc=u.isc,
            name=u.name,
            slug=u.slug,
            factions=[f.slug for f in u.factions],
            points_min=min((lo.points for lo in u.loadouts), default=0),
            points_max=max((lo.points for lo in u.loadouts), default=0),
        )
        for u in units
    ]


@router.get("/{slug}", response_model=UnitDetailResponse)
async def get_unit(
    slug: str, session: AsyncSession = Depends(get_session)
) -> UnitDetailResponse:
    """Get full unit details with profiles and loadouts."""
    result = await session.execute(
        select(Unit)
        .options(
            selectinload(Unit.factions),
            selectinload(Unit.profiles),
            selectinload(Unit.loadouts),
        )
        .where(Unit.slug == slug)
    )
    unit = result.scalar_one_or_none()
    if not unit:
        raise HTTPException(status_code=404, detail=f"Unit '{slug}' not found")

    weapon_map, skill_map, equip_map, extras_map = await _get_catalogs(session)

    return UnitDetailResponse(
        id=unit.id,
        isc=unit.isc,
        name=unit.name,
        slug=unit.slug,
        factions=[f.slug for f in unit.factions],
        profiles=[
            _build_profile_response(p, weapon_map, skill_map, equip_map, extras_map)
            for p in sorted(unit.profiles, key=lambda p: (p.profile_group_id, p.id))
        ],
        loadouts=[
            _build_loadout_response(lo, weapon_map, skill_map, equip_map, extras_map)
            for lo in sorted(
                unit.loadouts, key=lambda lo: (lo.profile_group_id, lo.option_id)
            )
        ],
    )
