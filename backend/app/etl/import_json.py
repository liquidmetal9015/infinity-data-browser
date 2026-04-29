"""ETL: Import Infinity game data from JSON files into PostgreSQL.

Reads the existing data/ directory (metadata.json + faction JSON files)
and populates all database tables. Idempotent — truncates existing data first.

Usage:
    cd backend
    PYTHONPATH=/path/to/backend python -m app.etl.import_json
"""

import asyncio
import json
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.models.base import Base
from app.models.faction import unit_factions
from app.models.fireteam import FireteamChart
from app.models.item import Ammunition, Equipment, Skill, Weapon
from app.models.unit import Loadout, Profile, Unit


# ---- Type coercion helpers ----
def _int(v: Any, default: int = 0) -> int:
    """Safely coerce to int."""
    try:
        return int(v) if v is not None else default
    except (ValueError, TypeError):
        return default


def _float(v: Any, default: float = 0.0) -> float:
    """Safely coerce to float."""
    try:
        return float(v) if v is not None else default
    except (ValueError, TypeError):
        return default


def _int_or_none(v: Any) -> int | None:
    """Coerce to int or None (treats 0 and '' as None)."""
    if v is None:
        return None
    try:
        result = int(v)
        return result if result != 0 else None
    except (ValueError, TypeError):
        return None


def resolve_data_dir() -> Path:
    """Find the data/ directory containing metadata.json."""
    candidates = [
        Path(__file__).parent.parent.parent / ".." / "data",
        Path(settings.data_dir),
    ]
    for p in candidates:
        resolved = p.resolve()
        if resolved.is_dir() and (resolved / "metadata.json").exists():
            return resolved
    raise FileNotFoundError(
        f"Could not find data directory. Tried: {[str(c.resolve()) for c in candidates]}"
    )


async def run_import() -> None:
    """Main ETL entry point."""
    data_dir = resolve_data_dir()
    print(f"Data directory: {data_dir}")

    engine = create_async_engine(settings.database_url, echo=False)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with session_factory() as session:
        # Truncate all tables cleanly (TRUNCATE is faster than DELETE and resets seq)
        print("Truncating existing data...")
        await session.execute(
            text(
                "TRUNCATE fireteam_charts, loadouts, profiles, unit_factions, units, "
                "weapons, skills, equipment, ammunitions, factions RESTART IDENTITY CASCADE"
            )
        )
        await session.commit()

        # 1. Load metadata.json
        print("Loading metadata...")
        metadata = json.loads((data_dir / "metadata.json").read_text())

        # Import factions — use ON CONFLICT DO NOTHING because:
        # 1. CB data has duplicate slugs (e.g. IDs 998/999 both use 'contracted-back-up')
        # 2. parent_id is plain int (no FK), so no ordering constraint
        faction_list = metadata["factions"]
        insert_faction_sql = text(
            "INSERT INTO factions (id, parent_id, name, slug, discontinued, logo) "
            "VALUES (:id, :parent_id, :name, :slug, :discontinued, :logo) "
            "ON CONFLICT DO NOTHING"
        )
        for f in faction_list:
            await session.execute(
                insert_faction_sql,
                {
                    "id": f["id"],
                    "parent_id": _int_or_none(f.get("parent")),
                    "name": f["name"],
                    "slug": f["slug"],
                    "discontinued": bool(f.get("discontinued", False)),
                    "logo": f.get("logo", ""),
                },
            )
        await session.flush()
        print(f"  {len(faction_list)} factions")

        # Import weapons — deduplicate by ID (CB data has up to 10 identical entries per ID)
        seen_weapon_ids: set[int] = set()
        for w in metadata.get("weapons", []):
            if w["id"] in seen_weapon_ids:
                continue
            seen_weapon_ids.add(w["id"])
            session.add(
                Weapon(
                    id=w["id"],
                    name=w["name"],
                    wiki_url=w.get("wiki"),
                    weapon_type=w.get("type"),
                    burst=w.get("burst"),
                    damage=w.get("damage"),
                    saving=w.get("saving"),
                    saving_num=w.get("savingNum"),
                    ammunition_id=_int_or_none(w.get("ammunition")),
                    properties=w.get("properties"),
                    distance=w.get("distance"),
                )
            )
        await session.flush()
        print(f"  {len(seen_weapon_ids)} weapons (unique)")

        # Import skills — deduplicate by ID
        seen_skill_ids: set[int] = set()
        for s in metadata.get("skills", []):
            if s["id"] in seen_skill_ids:
                continue
            seen_skill_ids.add(s["id"])
            session.add(Skill(id=s["id"], name=s["name"], wiki_url=s.get("wiki")))
        await session.flush()
        print(f"  {len(seen_skill_ids)} skills (unique)")

        # Import equipment — deduplicate by ID
        seen_equip_ids: set[int] = set()
        for e in metadata.get("equips", []):
            if e["id"] in seen_equip_ids:
                continue
            seen_equip_ids.add(e["id"])
            session.add(Equipment(id=e["id"], name=e["name"], wiki_url=e.get("wiki")))
        await session.flush()
        print(f"  {len(seen_equip_ids)} equipment (unique)")

        # Import ammunition — deduplicate by ID
        seen_ammo_ids: set[int] = set()
        for a in metadata.get("ammunitions", []):
            if a["id"] in seen_ammo_ids:
                continue
            seen_ammo_ids.add(a["id"])
            session.add(Ammunition(id=a["id"], name=a["name"], wiki_url=a.get("wiki")))
        await session.flush()
        print(f"  {len(seen_ammo_ids)} ammunitions (unique)")

        # 2. Load faction data files (units, profiles, loadouts, fireteam charts)
        print("\nLoading faction unit data...")
        seen_iscs: dict[str, int] = {}  # ISC -> unit.id (dedup across factions)
        total_units = 0
        total_profiles = 0
        total_loadouts = 0
        faction_files_loaded = 0

        # Fetch valid faction IDs that actully made it into the DB
        valid_faction_ids = {
            r[0] for r in await session.execute(text("SELECT id FROM factions"))
        }

        for faction_meta in metadata["factions"]:
            faction_id = faction_meta["id"]
            if faction_id not in valid_faction_ids:
                print(
                    f"  Skipping faction {faction_id} - not in DB (likely duplicate slug)"
                )
                continue

            slug = faction_meta["slug"]
            faction_file = data_dir / f"{slug}.json"
            if not faction_file.exists():
                continue

            faction_data = json.loads(faction_file.read_text())
            faction_id = faction_meta["id"]
            faction_files_loaded += 1

            # Fireteam chart
            if faction_data.get("fireteamChart"):
                session.add(
                    FireteamChart(
                        faction_id=faction_id,
                        chart_json=faction_data["fireteamChart"],
                    )
                )

            # Units — must be a list of dicts
            for raw_unit in faction_data.get("units") or []:
                if not isinstance(raw_unit, dict):
                    continue

                isc = raw_unit.get("isc", "")
                if not isc:
                    continue

                unit_slug = raw_unit.get("slug") or isc.lower().replace(" ", "-")

                if isc in seen_iscs:
                    # Already imported — just add faction link
                    await session.execute(
                        pg_insert(unit_factions)
                        .values(unit_id=seen_iscs[isc], faction_id=faction_id)
                        .on_conflict_do_nothing()
                    )
                    continue

                # New unit
                unit = Unit(
                    id=raw_unit["id"],
                    id_army=_int_or_none(raw_unit.get("idArmy")),
                    isc=isc,
                    name=raw_unit.get("name") or isc,
                    slug=unit_slug,
                    logo=raw_unit.get("logo"),
                    raw_json=raw_unit,
                )
                session.add(unit)
                await session.flush()

                seen_iscs[isc] = unit.id
                total_units += 1

                await session.execute(
                    pg_insert(unit_factions)
                    .values(unit_id=unit.id, faction_id=faction_id)
                    .on_conflict_do_nothing()
                )

                # Profiles and loadouts
                for pg in raw_unit.get("profileGroups") or []:
                    if not isinstance(pg, dict):
                        continue
                    pg_id = _int(pg.get("id", 0))

                    for p in pg.get("profiles") or []:
                        if not isinstance(p, dict):
                            continue
                        move = p.get("move") or [0, 0]
                        if not isinstance(move, list):
                            move = [0, 0]
                        session.add(
                            Profile(
                                unit_id=unit.id,
                                profile_group_id=pg_id,
                                name=p.get("name") or isc,
                                mov_1=_int(move[0] if len(move) > 0 else 0),
                                mov_2=_int(move[1] if len(move) > 1 else 0),
                                cc=_int(p.get("cc")),
                                bs=_int(p.get("bs")),
                                ph=_int(p.get("ph")),
                                wip=_int(p.get("wip")),
                                arm=_int(p.get("arm")),
                                bts=_int(p.get("bts")),
                                wounds=_int(p.get("w")),
                                silhouette=_int(p.get("s")),
                                is_structure=bool(p.get("str", False)),
                                unit_type=_int_or_none(p.get("type")),
                                skills_json=p.get("skills") or [],
                                equipment_json=p.get("equip") or [],
                                weapons_json=p.get("weapons") or [],
                            )
                        )
                        total_profiles += 1

                    for o in pg.get("options") or []:
                        if not isinstance(o, dict):
                            continue
                        session.add(
                            Loadout(
                                unit_id=unit.id,
                                profile_group_id=pg_id,
                                option_id=_int(o.get("id", 0)),
                                name=o.get("name") or "",
                                points=_int(o.get("points")),
                                swc=_float(
                                    o.get("swc")
                                ),  # CB stores swc as string in some entries
                                skills_json=o.get("skills") or [],
                                equipment_json=o.get("equip") or [],
                                weapons_json=o.get("weapons") or [],
                                orders_json=o.get("orders"),
                            )
                        )
                        total_loadouts += 1

            await session.flush()

        await session.commit()

    print("\nImport complete:")
    print(f"  {faction_files_loaded} faction files")
    print(f"  {total_units} unique units")
    print(f"  {total_profiles} profiles")
    print(f"  {total_loadouts} loadouts")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run_import())
