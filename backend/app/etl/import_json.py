"""ETL: Import Infinity game data from processed JSON files into PostgreSQL.

Reads data/processed/ (output of the TypeScript ETL pipeline) and populates
all database tables. Idempotent — truncates existing data first.

Usage:
    cd backend
    python -m app.etl.import_json
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


def resolve_data_dir() -> Path:
    """Find the data/processed/ directory output by the TypeScript ETL."""
    candidates = [
        Path(__file__).parent.parent.parent / ".." / "data" / "processed",
        Path(settings.data_dir) / "processed",
        Path(settings.data_dir),
    ]
    for p in candidates:
        resolved = p.resolve()
        if resolved.is_dir() and (resolved / "metadata.json").exists():
            return resolved
    raise FileNotFoundError(
        f"Could not find data/processed directory. Tried: {[str(c.resolve()) for c in candidates]}"
    )


def _item_refs(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Extract compact {id, modifiers} refs from processed item objects for DB storage.

    Items without an 'id' (e.g. Weapon#undefined from unresolved CB source data) are skipped.
    """
    return [
        {"id": item["id"], "modifiers": item.get("modifiers", [])}
        for item in items
        if "id" in item
    ]


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

        # 1. Load item catalogs from metadata.json
        print("Loading metadata...")
        metadata = json.loads((data_dir / "metadata.json").read_text())

        # Weapons — deduplicate by ID
        seen_weapon_ids: set[int] = set()
        for w in metadata.get("weapons", []):
            if w["id"] in seen_weapon_ids:
                continue
            seen_weapon_ids.add(w["id"])
            session.add(
                Weapon(
                    id=w["id"],
                    name=w["name"],
                    weapon_type=w.get("weaponType"),
                    burst=w.get("burst"),
                    damage=w.get("damage"),
                    saving=w.get("saving"),
                    saving_num=w.get("savingNum"),
                    ammunition_id=int(w.get("ammunition") or 0) or None,
                    properties=w.get("properties"),
                    distance=w.get("distance"),
                )
            )
        await session.flush()
        print(f"  {len(seen_weapon_ids)} weapons (unique)")

        # Skills — deduplicate by ID
        seen_skill_ids: set[int] = set()
        for s in metadata.get("skills", []):
            if s["id"] in seen_skill_ids:
                continue
            seen_skill_ids.add(s["id"])
            session.add(Skill(id=s["id"], name=s["name"], wiki_url=s.get("wikiUrl")))
        await session.flush()
        print(f"  {len(seen_skill_ids)} skills (unique)")

        # Equipment — deduplicate by ID
        seen_equip_ids: set[int] = set()
        for e in metadata.get("equipment", []):
            if e["id"] in seen_equip_ids:
                continue
            seen_equip_ids.add(e["id"])
            session.add(
                Equipment(id=e["id"], name=e["name"], wiki_url=e.get("wikiUrl"))
            )
        await session.flush()
        print(f"  {len(seen_equip_ids)} equipment (unique)")

        # Ammunition — deduplicate by ID
        seen_ammo_ids: set[int] = set()
        for a in metadata.get("ammunitions", []):
            if a["id"] in seen_ammo_ids:
                continue
            seen_ammo_ids.add(a["id"])
            session.add(
                Ammunition(id=a["id"], name=a["name"], wiki_url=a.get("wikiUrl"))
            )
        await session.flush()
        print(f"  {len(seen_ammo_ids)} ammunitions (unique)")

        # 2. Load factions from factions.json
        # CB data can produce duplicate slugs (e.g. IDs 998/999 both map to 'contracted-back-up'),
        # so we use ON CONFLICT DO NOTHING to skip duplicates cleanly.
        print("\nLoading factions...")
        factions_data = json.loads((data_dir / "factions.json").read_text())
        faction_list: list[dict[str, Any]] = factions_data["factions"]
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
                    "parent_id": f.get("parentId"),
                    "name": f["name"],
                    "slug": f["slug"],
                    "discontinued": bool(f.get("discontinued", False)),
                    "logo": f.get("logo", ""),
                },
            )
            if f.get("fireteams"):
                session.add(
                    FireteamChart(
                        faction_id=f["id"],
                        chart_json=f["fireteams"],
                    )
                )
        await session.flush()
        print(f"  {len(faction_list)} factions")

        # Fetch valid faction IDs that actually made it into the DB
        valid_faction_ids = {
            r[0] for r in await session.execute(text("SELECT id FROM factions"))
        }

        # 3. Load unit data from per-faction processed files
        print("\nLoading faction unit data...")
        seen_iscs: dict[str, int] = {}  # ISC -> unit.id (dedup across factions)
        total_units = 0
        total_profiles = 0
        total_loadouts = 0
        faction_files_loaded = 0

        for f in faction_list:
            faction_id = f["id"]
            if faction_id not in valid_faction_ids:
                print(
                    f"  Skipping faction {faction_id} — not in DB (likely duplicate slug)"
                )
                continue

            slug = f["slug"]
            faction_file = data_dir / f"{slug}.json"
            if not faction_file.exists():
                continue

            faction_data = json.loads(faction_file.read_text())
            faction_files_loaded += 1

            for unit_data in faction_data.get("units") or []:
                isc = unit_data.get("isc", "")
                if not isc:
                    continue

                if isc in seen_iscs:
                    # Already imported — add faction link only
                    await session.execute(
                        pg_insert(unit_factions)
                        .values(unit_id=seen_iscs[isc], faction_id=faction_id)
                        .on_conflict_do_nothing()
                    )
                    continue

                unit = Unit(
                    id=unit_data["id"],
                    isc=isc,
                    name=unit_data.get("name") or isc,
                    slug=unit_data["slug"],
                    raw_json=unit_data,
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

                for pg in unit_data.get("profileGroups") or []:
                    pg_id: int = pg["id"]

                    for p in pg.get("profiles") or []:
                        move: list[int] = p.get("move") or [0, 0]
                        session.add(
                            Profile(
                                unit_id=unit.id,
                                profile_group_id=pg_id,
                                name=p.get("name") or isc,
                                mov_1=move[0] if len(move) > 0 else 0,
                                mov_2=move[1] if len(move) > 1 else 0,
                                cc=p.get("cc", 0),
                                bs=p.get("bs", 0),
                                ph=p.get("ph", 0),
                                wip=p.get("wip", 0),
                                arm=p.get("arm", 0),
                                bts=p.get("bts", 0),
                                wounds=p.get("w", 0),
                                silhouette=p.get("s", 0),
                                is_structure=bool(p.get("isStructure", False)),
                                unit_type=p.get("unitType"),
                                skills_json=_item_refs(p.get("skills") or []),
                                equipment_json=_item_refs(p.get("equipment") or []),
                                weapons_json=_item_refs(p.get("weapons") or []),
                            )
                        )
                        total_profiles += 1

                    for o in pg.get("options") or []:
                        session.add(
                            Loadout(
                                unit_id=unit.id,
                                profile_group_id=pg_id,
                                option_id=o["id"],
                                name=o.get("name") or "",
                                points=o.get("points", 0),
                                swc=float(o.get("swc", 0.0)),
                                skills_json=_item_refs(o.get("skills") or []),
                                equipment_json=_item_refs(o.get("equipment") or []),
                                weapons_json=_item_refs(o.get("weapons") or []),
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
