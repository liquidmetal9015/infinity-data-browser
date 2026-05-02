"""ToolExecutor — dispatches LLM tool calls to their implementations."""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.agent.game_data.dice_engine import CombatantInput, calculate_f2f
from app.agent.game_data.fireteam_logic import get_fireteam_bonuses
from app.agent.game_data.loader import GameDataLoader
from app.models.faction import Faction
from app.models.fireteam import FireteamChart
from app.models.unit import Loadout, Unit
from app.routers.units import (
    _build_loadout_response,
    _build_profile_response,
    _get_catalogs,
)


class ToolExecutor:
    def __init__(self, db: AsyncSession, loader: GameDataLoader) -> None:
        self._db = db
        self._loader = loader
        self._handlers = {
            "search_units": self._search_units,
            "get_unit_profile": self._get_unit_profile,
            "get_faction_context": self._get_faction_context,
            "validate_fireteam": self._validate_fireteam,
            "analyze_matchup": self._analyze_matchup,
            "analyze_classifieds": self._analyze_classifieds,
        }

    async def execute(self, tool_name: str, tool_input: dict[str, Any]) -> str:
        handler = self._handlers.get(tool_name)
        if not handler:
            return json.dumps({"error": f"Unknown tool: {tool_name}"})
        try:
            result = await handler(**tool_input)
            return json.dumps(result)
        except Exception as e:
            return json.dumps({"error": str(e)})

    async def _search_units(
        self,
        query: str | None = None,
        faction_id: int | None = None,
        min_points: int | None = None,
        max_points: int | None = None,
        limit: int = 20,
    ) -> dict[str, Any]:
        q = (
            select(Unit)
            .options(selectinload(Unit.factions), selectinload(Unit.loadouts))
            .distinct()
        )

        if query:
            pattern = f"%{query}%"
            q = q.where(or_(Unit.name.ilike(pattern), Unit.isc.ilike(pattern)))

        if faction_id is not None:
            q = q.join(Unit.factions).where(Faction.id == faction_id)

        if min_points is not None or max_points is not None:
            q = q.join(Unit.loadouts)
            if min_points is not None:
                q = q.where(Loadout.points >= min_points)
            if max_points is not None:
                q = q.where(Loadout.points <= max_points)

        q = q.order_by(Unit.name).limit(min(limit, 30))
        result = await self._db.execute(q)
        units = result.scalars().unique().all()

        return {
            "count": len(units),
            "units": [
                {
                    "name": u.name,
                    "isc": u.isc,
                    "slug": u.slug,
                    "factions": [f.slug for f in u.factions],
                    "points_min": min((lo.points for lo in u.loadouts), default=0),
                    "points_max": max((lo.points for lo in u.loadouts), default=0),
                }
                for u in units
            ],
        }

    async def _get_unit_profile(self, slug: str) -> dict[str, Any]:
        result = await self._db.execute(
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
            return {"error": f"Unit '{slug}' not found"}

        weapon_map, skill_map, equip_map = await _get_catalogs(self._db)

        profiles = [
            _build_profile_response(p, weapon_map, skill_map, equip_map)
            for p in sorted(unit.profiles, key=lambda p: (p.profile_group_id, p.id))
        ]
        loadouts = [
            _build_loadout_response(lo, weapon_map, skill_map, equip_map)
            for lo in sorted(
                unit.loadouts[:5],
                key=lambda lo: (lo.profile_group_id, lo.option_id),
            )
        ]

        return {
            "name": unit.name,
            "isc": unit.isc,
            "slug": unit.slug,
            "factions": [f.slug for f in unit.factions],
            "profiles": [
                {
                    "name": p.name,
                    "mov": p.mov,
                    "cc": p.cc,
                    "bs": p.bs,
                    "ph": p.ph,
                    "wip": p.wip,
                    "arm": p.arm,
                    "bts": p.bts,
                    "wounds": p.wounds,
                    "silhouette": p.silhouette,
                    "unit_type": p.unit_type,
                    "skills": [
                        {"name": s.name, "modifiers": s.extra_display} for s in p.skills
                    ],
                    "equipment": [
                        {"name": e.name, "modifiers": e.extra_display}
                        for e in p.equipment
                    ],
                    "weapons": [
                        {"name": w.name, "modifiers": w.extra_display}
                        for w in p.weapons
                    ],
                }
                for p in profiles
            ],
            "loadouts": [
                {
                    "name": lo.name,
                    "points": lo.points,
                    "swc": lo.swc,
                    "weapons": [
                        {"name": w.name, "modifiers": w.extra_display}
                        for w in lo.weapons
                    ],
                    "skills": [
                        {"name": s.name, "modifiers": s.extra_display}
                        for s in lo.skills
                    ],
                    "equipment": [
                        {"name": e.name, "modifiers": e.extra_display}
                        for e in lo.equipment
                    ],
                }
                for lo in loadouts
            ],
        }

    async def _get_faction_context(
        self,
        faction_id: int,
        include_roster: bool = True,
        include_fireteams: bool = True,
    ) -> dict[str, Any]:
        faction_result = await self._db.execute(
            select(Faction).where(Faction.id == faction_id)
        )
        faction = faction_result.scalar_one_or_none()
        if not faction:
            return {"error": f"Faction {faction_id} not found"}

        out: dict[str, Any] = {
            "id": faction.id,
            "name": faction.name,
            "slug": faction.slug,
        }

        if include_fireteams:
            ft_result = await self._db.execute(
                select(FireteamChart).where(FireteamChart.faction_id == faction_id)
            )
            ft_chart = ft_result.scalar_one_or_none()
            if ft_chart:
                teams = ft_chart.chart_json.get("teams", [])
                out["fireteams"] = [
                    {
                        "name": t.get("name"),
                        "type": t.get("type", []),
                        "slots": [
                            {
                                "name": u.get("name"),
                                "min": u.get("min", 0),
                                "max": u.get("max", 1),
                            }
                            for u in t.get("units", [])
                        ],
                    }
                    for t in teams
                ]

        if include_roster:
            q = (
                select(Unit)
                .options(selectinload(Unit.factions), selectinload(Unit.loadouts))
                .join(Unit.factions)
                .where(Faction.id == faction_id)
                .order_by(Unit.name)
                .limit(30)
            )
            units_result = await self._db.execute(q)
            units = units_result.scalars().unique().all()
            out["roster"] = [
                {
                    "name": u.name,
                    "isc": u.isc,
                    "slug": u.slug,
                    "points_min": min((lo.points for lo in u.loadouts), default=0),
                    "points_max": max((lo.points for lo in u.loadouts), default=0),
                }
                for u in units
            ]
            out["roster_truncated"] = len(units) == 30

        return out

    async def _validate_fireteam(
        self,
        faction_id: int,
        team_name: str,
        member_names: list[str],
    ) -> dict[str, Any]:
        ft_result = await self._db.execute(
            select(FireteamChart).where(FireteamChart.faction_id == faction_id)
        )
        ft_chart = ft_result.scalar_one_or_none()
        if not ft_chart:
            return {"error": f"No fireteam chart found for faction {faction_id}"}

        teams = ft_chart.chart_json.get("teams", [])
        team = next(
            (t for t in teams if t.get("name", "").lower() == team_name.lower()),
            None,
        )
        if not team:
            available = [t.get("name") for t in teams]
            return {
                "error": f"Team '{team_name}' not found",
                "available_teams": available,
            }

        members = [{"name": n} for n in member_names]
        bonuses = get_fireteam_bonuses(team, members)

        active_bonuses = [b for b in bonuses if b.is_active]
        return {
            "team": team_name,
            "members": member_names,
            "is_valid": len(active_bonuses) > 0,
            "bonuses": [
                {"level": b.level, "description": b.description, "active": b.is_active}
                for b in bonuses
            ],
            "active_level": max((b.level for b in active_bonuses), default=0),
        }

    async def _analyze_matchup(
        self,
        active_sv: int,
        active_burst: int,
        active_damage: int,
        reactive_sv: int,
        reactive_burst: int,
        reactive_damage: int,
        target_arm: int,
        active_arm: int,
        active_ammo: str = "NORMAL",
        reactive_ammo: str = "NORMAL",
    ) -> dict[str, Any]:
        active = CombatantInput(
            sv=active_sv,
            burst=active_burst,
            damage=active_damage,
            ammo=active_ammo,
            arm=active_arm,
        )
        reactive = CombatantInput(
            sv=reactive_sv,
            burst=reactive_burst,
            damage=reactive_damage,
            ammo=reactive_ammo,
            arm=target_arm,
        )
        result = calculate_f2f(active, reactive)

        return {
            "active_wins_pct": result.active_wins,
            "reactive_wins_pct": result.reactive_wins,
            "draw_pct": result.draw,
            "expected_wounds_on_reactive": result.expected_active_wounds,
            "expected_wounds_on_active": result.expected_reactive_wounds,
            "wound_distribution_on_reactive": result.wound_dist_active,
            "wound_distribution_on_active": result.wound_dist_reactive,
            "summary": (
                f"Active player wins {result.active_wins}% of the time, "
                f"dealing {result.expected_active_wounds:.2f} expected wounds. "
                f"Reactive wins {result.reactive_wins}%."
            ),
        }

    async def _analyze_classifieds(
        self,
        unit_names: list[str],
    ) -> dict[str, Any]:
        classifieds = self._loader.classifieds
        if not classifieds:
            return {"error": "Classifieds data not available"}

        lower_names = {n.lower() for n in unit_names}

        completable = []
        not_completable = []

        for obj in classifieds:
            designated = [t.lower() for t in obj.get("designatedTroopers", [])]
            if not designated:
                completable.append(
                    {"name": obj["name"], "category": obj.get("category", "")}
                )
                continue

            can_complete = any(
                any(d in n or n in d for n in lower_names) for d in designated
            )

            if can_complete:
                completable.append(
                    {
                        "name": obj["name"],
                        "category": obj.get("category", ""),
                        "requires": obj.get("designatedTroopers", []),
                    }
                )
            else:
                not_completable.append(
                    {
                        "name": obj["name"],
                        "category": obj.get("category", ""),
                        "requires": obj.get("designatedTroopers", []),
                    }
                )

        total = len(classifieds)
        pct = round(len(completable) / total * 100) if total else 0

        return {
            "coverage_pct": pct,
            "completable_count": len(completable),
            "total_count": total,
            "completable": completable,
            "not_completable": not_completable,
            "summary": f"Your list can complete {len(completable)}/{total} classifieds ({pct}%).",
        }
