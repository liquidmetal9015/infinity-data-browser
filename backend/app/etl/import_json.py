"""ETL: Import Infinity game data from JSON files into PostgreSQL.

Reads the existing data/ directory (metadata.json + faction JSON files)
and populates all database tables.

Usage:
    cd backend
    python -m app.etl.import_json
"""

import asyncio
import json
import sys
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.config import settings
from app.models.base import Base
from app.models.faction import Faction, unit_factions
from app.models.item import Weapon, Skill, Equipment, Ammunition
from app.models.unit import Unit, Profile, Loadout
from app.models.fireteam import FireteamChart


def resolve_data_dir() -> Path:
    """Resolve the data directory path."""
    # Try relative to backend/ first, then absolute
    candidates = [
        Path(__file__).parent.parent.parent / ".." / "data",  # backend/app/etl/../../data
        Path(settings.data_dir),
    ]
    for p in candidates:
        resolved = p.resolve()
        if resolved.is_dir() and (resolved / "metadata.json").exists():
            return resolved
    raise FileNotFoundError(
        f"Could not find data directory with metadata.json. Tried: {[str(c.resolve()) for c in candidates]}"
    )


async def run_import():
    """Main ETL entry point."""
    data_dir = resolve_data_dir()
    print(f"📂 Data directory: {data_dir}")

    engine = create_async_engine(settings.database_url, echo=False)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        # Create all tables (idempotent — won't drop existing)
        await conn.run_sync(Base.metadata.create_all)

    async with session_factory() as session:
        # Check if data already exists
        result = await session.execute(text("SELECT COUNT(*) FROM factions"))
        count = result.scalar()
        if count and count > 0:
            print(f"⚠️  Database already has {count} factions. Clearing for fresh import...")
            # Clear in dependency order
            await session.execute(text("DELETE FROM fireteam_charts"))
            await session.execute(text("DELETE FROM loadouts"))
            await session.execute(text("DELETE FROM profiles"))
            await session.execute(text("DELETE FROM unit_factions"))
            await session.execute(text("DELETE FROM units"))
            await session.execute(text("DELETE FROM weapons"))
            await session.execute(text("DELETE FROM skills"))
            await session.execute(text("DELETE FROM equipment"))
            await session.execute(text("DELETE FROM ammunitions"))
            await session.execute(text("DELETE FROM factions"))
            await session.commit()

        # 1. Load metadata
        print("📋 Loading metadata...")
        metadata = json.loads((data_dir / "metadata.json").read_text())

        # Import factions
        for f in metadata["factions"]:
            faction = Faction(
                id=f["id"],
                parent_id=f.get("parent", f["id"]),
                name=f["name"],
                slug=f["slug"],
                discontinued=f.get("discontinued", False),
                logo=f.get("logo", ""),
            )
            session.add(faction)
        await session.flush()
        print(f"  ✓ {len(metadata['factions'])} factions")

        # Import weapons
        for w in metadata.get("weapons", []):
            weapon = Weapon(
                id=w["id"],
                name=w["name"],
                wiki_url=w.get("wiki"),
                weapon_type=w.get("type"),
                burst=w.get("burst"),
                damage=w.get("damage"),
                saving=w.get("saving"),
                saving_num=w.get("savingNum"),
                ammunition_id=w.get("ammunition"),
                properties=w.get("properties"),
                distance=w.get("distance"),
            )
            session.add(weapon)
        await session.flush()
        print(f"  ✓ {len(metadata.get('weapons', []))} weapons")

        # Import skills
        for s in metadata.get("skills", []):
            skill = Skill(id=s["id"], name=s["name"], wiki_url=s.get("wiki"))
            session.add(skill)
        await session.flush()
        print(f"  ✓ {len(metadata.get('skills', []))} skills")

        # Import equipment
        for e in metadata.get("equips", []):
            equip = Equipment(id=e["id"], name=e["name"], wiki_url=e.get("wiki"))
            session.add(equip)
        await session.flush()
        print(f"  ✓ {len(metadata.get('equips', []))} equipment")

        # Import ammunition
        for a in metadata.get("ammunitions", []):
            ammo = Ammunition(id=a["id"], name=a["name"], wiki_url=a.get("wiki"))
            session.add(ammo)
        await session.flush()
        print(f"  ✓ {len(metadata.get('ammunitions', []))} ammunitions")

        # 2. Load faction data files
        print("\n🎖️  Loading faction data...")
        seen_iscs: dict[str, int] = {}  # ISC → unit DB ID (for dedup)
        total_units = 0
        total_profiles = 0
        total_loadouts = 0
        faction_slugs_loaded = 0

        for faction_meta in metadata["factions"]:
            slug = faction_meta["slug"]
            faction_file = data_dir / f"{slug}.json"
            if not faction_file.exists():
                continue

            faction_data = json.loads(faction_file.read_text())
            faction_id = faction_meta["id"]
            faction_slugs_loaded += 1

            # Import fireteam chart
            if "fireteamChart" in faction_data and faction_data["fireteamChart"]:
                chart = FireteamChart(
                    faction_id=faction_id,
                    chart_json=faction_data["fireteamChart"],
                )
                session.add(chart)

            # Import units
            for raw_unit in faction_data.get("units", []):
                isc = raw_unit["isc"]
                unit_slug = raw_unit.get("slug", isc.lower().replace(" ", "-"))

                if isc in seen_iscs:
                    # Unit already imported from another faction — just add the faction link
                    existing_unit_id = seen_iscs[isc]
                    await session.execute(
                        unit_factions.insert().values(
                            unit_id=existing_unit_id, faction_id=faction_id
                        ).prefix_with("OR IGNORE")
                    )
                    continue

                # Create new unit
                unit = Unit(
                    id=raw_unit["id"],
                    id_army=raw_unit.get("idArmy"),
                    isc=isc,
                    name=raw_unit["name"],
                    slug=unit_slug,
                    logo=raw_unit.get("logo"),
                    raw_json=raw_unit,
                )
                session.add(unit)
                await session.flush()  # Get the ID

                seen_iscs[isc] = unit.id
                total_units += 1

                # Link to faction
                await session.execute(
                    unit_factions.insert().values(
                        unit_id=unit.id, faction_id=faction_id
                    )
                )

                # Import profiles and loadouts from profile groups
                for pg in raw_unit.get("profileGroups", []):
                    pg_id = pg["id"]

                    for p in pg.get("profiles", []):
                        move = p.get("move", [0, 0])
                        profile = Profile(
                            unit_id=unit.id,
                            profile_group_id=pg_id,
                            name=p.get("name", isc),
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
                            is_structure=p.get("str", False),
                            unit_type=p.get("type"),
                            skills_json=p.get("skills", []),
                            equipment_json=p.get("equip", []),
                            weapons_json=p.get("weapons", []),
                        )
                        session.add(profile)
                        total_profiles += 1

                    for o in pg.get("options", []):
                        loadout = Loadout(
                            unit_id=unit.id,
                            profile_group_id=pg_id,
                            option_id=o["id"],
                            name=o.get("name", ""),
                            points=o.get("points", 0),
                            swc=o.get("swc", 0),
                            skills_json=o.get("skills", []),
                            equipment_json=o.get("equip", []),
                            weapons_json=o.get("weapons", []),
                            orders_json=o.get("orders"),
                        )
                        session.add(loadout)
                        total_loadouts += 1

            # Flush per-faction to keep memory manageable
            await session.flush()

        await session.commit()

        print(f"\n✅ Import complete!")
        print(f"   {faction_slugs_loaded} factions loaded")
        print(f"   {total_units} unique units")
        print(f"   {total_profiles} profiles")
        print(f"   {total_loadouts} loadouts")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run_import())
