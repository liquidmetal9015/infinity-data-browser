"""Search API route — server-side unit search with filtering."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, or_, func, cast, String
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_session
from app.models.faction import Faction
from app.models.unit import Unit, Profile, Loadout
from app.models.item import Weapon, Skill, Equipment
from app.schemas.unit import UnitSummaryResponse

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("", response_model=list[UnitSummaryResponse])
async def search_units(
    q: str | None = Query(None, description="Text search query (name or ISC)"),
    faction: str | None = Query(None, description="Filter by faction slug"),
    has_weapon: int | None = Query(None, description="Filter by weapon ID"),
    has_skill: int | None = Query(None, description="Filter by skill ID"),
    has_equipment: int | None = Query(None, description="Filter by equipment ID"),
    min_points: int | None = Query(None, description="Minimum points cost"),
    max_points: int | None = Query(None, description="Maximum points cost"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    """Search units with text query and/or attribute filters.

    Filters are ANDed together. Text search matches name and ISC (case-insensitive).
    Item filters use the JSONB arrays on profiles and loadouts.
    """
    query = select(Unit).options(
        selectinload(Unit.factions),
        selectinload(Unit.loadouts),
    ).distinct()

    # Text search — case-insensitive ILIKE
    if q:
        pattern = f"%{q}%"
        query = query.where(
            or_(
                Unit.name.ilike(pattern),
                Unit.isc.ilike(pattern),
            )
        )

    # Faction filter
    if faction:
        query = query.join(Unit.factions).where(Faction.slug == faction)

    # Weapon filter — check JSONB on profiles and loadouts
    if has_weapon:
        weapon_filter = func.jsonb_path_exists(
            Unit.raw_json,
            cast(f'$.profileGroups[*].profiles[*].weapons[*] ? (@.id == {has_weapon})', String),
        )
        weapon_filter_opts = func.jsonb_path_exists(
            Unit.raw_json,
            cast(f'$.profileGroups[*].options[*].weapons[*] ? (@.id == {has_weapon})', String),
        )
        query = query.where(or_(weapon_filter, weapon_filter_opts))

    # Skill filter
    if has_skill:
        skill_filter = func.jsonb_path_exists(
            Unit.raw_json,
            cast(f'$.profileGroups[*].profiles[*].skills[*] ? (@.id == {has_skill})', String),
        )
        skill_filter_opts = func.jsonb_path_exists(
            Unit.raw_json,
            cast(f'$.profileGroups[*].options[*].skills[*] ? (@.id == {has_skill})', String),
        )
        query = query.where(or_(skill_filter, skill_filter_opts))

    # Equipment filter
    if has_equipment:
        equip_filter = func.jsonb_path_exists(
            Unit.raw_json,
            cast(f'$.profileGroups[*].profiles[*].equip[*] ? (@.id == {has_equipment})', String),
        )
        equip_filter_opts = func.jsonb_path_exists(
            Unit.raw_json,
            cast(f'$.profileGroups[*].options[*].equip[*] ? (@.id == {has_equipment})', String),
        )
        query = query.where(or_(equip_filter, equip_filter_opts))

    # Points filter — requires joining loadouts
    if min_points is not None or max_points is not None:
        query = query.join(Unit.loadouts)
        if min_points is not None:
            query = query.where(Loadout.points >= min_points)
        if max_points is not None:
            query = query.where(Loadout.points <= max_points)

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
