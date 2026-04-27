"""Faction API routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_session
from app.models.faction import Faction, unit_factions
from app.models.fireteam import FireteamChart
from app.models.unit import Unit
from app.schemas.faction import FactionDetailResponse, FactionSummary, SuperFactionResponse

router = APIRouter(prefix="/api/factions", tags=["factions"])


@router.get("", response_model=list[SuperFactionResponse])
async def list_factions_grouped(session: AsyncSession = Depends(get_session)):
    """Get all factions grouped by super-faction."""
    result = await session.execute(
        select(Faction).order_by(Faction.name)
    )
    all_factions = result.scalars().all()

    # Group: super-factions have parent_id == id or parent_id is None
    super_factions: dict[int, SuperFactionResponse] = {}

    for f in all_factions:
        summary = FactionSummary(
            id=f.id,
            name=f.name,
            slug=f.slug,
            parent_id=f.parent_id,
            is_vanilla=f.is_vanilla,
            discontinued=f.discontinued,
            logo=f.logo,
        )

        parent_key = f.parent_id if f.parent_id else f.id
        if parent_key not in super_factions:
            super_factions[parent_key] = SuperFactionResponse(
                id=parent_key,
                name="",
                vanilla=None,
                sectorials=[],
            )

        group = super_factions[parent_key]
        if f.is_vanilla:
            group.vanilla = summary
            group.name = f.name
            group.id = f.id
        else:
            group.sectorials.append(summary)

    # Fill in names for groups that only have sectorials (no vanilla entry)
    for group in super_factions.values():
        if not group.name and group.sectorials:
            group.name = group.sectorials[0].name

    return sorted(super_factions.values(), key=lambda g: g.name)


@router.get("/{slug}", response_model=FactionDetailResponse)
async def get_faction(slug: str, session: AsyncSession = Depends(get_session)):
    """Get faction details including unit count and fireteam chart."""
    result = await session.execute(
        select(Faction).where(Faction.slug == slug)
    )
    faction = result.scalar_one_or_none()
    if not faction:
        raise HTTPException(status_code=404, detail=f"Faction '{slug}' not found")

    # Count units in this faction
    count_result = await session.execute(
        select(func.count()).select_from(unit_factions).where(
            unit_factions.c.faction_id == faction.id
        )
    )
    unit_count = count_result.scalar() or 0

    # Get fireteam chart
    chart_result = await session.execute(
        select(FireteamChart).where(FireteamChart.faction_id == faction.id)
    )
    chart = chart_result.scalar_one_or_none()

    return FactionDetailResponse(
        id=faction.id,
        name=faction.name,
        slug=faction.slug,
        parent_id=faction.parent_id,
        is_vanilla=faction.is_vanilla,
        discontinued=faction.discontinued,
        logo=faction.logo,
        fireteam_chart=chart.chart_json if chart else None,
        unit_count=unit_count,
    )

@router.get("/{slug}/legacy")
async def get_faction_legacy(slug: str, session: AsyncSession = Depends(get_session)):
    """Return raw JSON blob exactly matching frontend legacy layout."""
    result = await session.execute(select(Faction).where(Faction.slug == slug))
    faction = result.scalar_one_or_none()
    if not faction:
        raise HTTPException(status_code=404, detail="Faction not found")
        
    units_result = await session.execute(
        select(Unit.raw_json)
        .join(unit_factions)
        .where(unit_factions.c.faction_id == faction.id)
    )
    units_json = units_result.scalars().all()
    
    chart_result = await session.execute(
        select(FireteamChart.chart_json).where(FireteamChart.faction_id == faction.id)
    )
    chart_json = chart_result.scalar_one_or_none()
    
    return {
        "version": "1.0",
        "units": units_json,
        "fireteamChart": chart_json
    }
