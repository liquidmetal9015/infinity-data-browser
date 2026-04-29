"""Unit, Profile, and Loadout models.

These represent the core game data entities. The raw Corvus Belli JSON
is preserved as a JSONB column on Unit for fallback/debugging, while
the structured columns enable efficient querying.
"""

from typing import Any

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.faction import unit_factions


class Unit(Base):
    __tablename__ = "units"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_army: Mapped[int | None] = mapped_column(Integer, nullable=True)
    isc: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    logo: Mapped[str | None] = mapped_column(String, nullable=True)

    # Full raw JSON from Corvus Belli — escape hatch for data we haven't normalized
    raw_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)

    # Fireteam chart data for the unit (if applicable, per-faction)
    # This is denormalized here for convenience; fireteams are faction-specific.

    # Relationships
    factions: Mapped[list["Faction"]] = relationship(  # noqa: F821
        secondary=unit_factions,
        back_populates="units",
    )
    profiles: Mapped[list["Profile"]] = relationship(
        back_populates="unit",
        cascade="all, delete-orphan",
    )
    loadouts: Mapped[list["Loadout"]] = relationship(
        back_populates="unit",
        cascade="all, delete-orphan",
    )


class Profile(Base):
    """A unit's stat line. Units can have multiple profiles (e.g., Transmutation)."""

    __tablename__ = "profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    unit_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("units.id", ondelete="CASCADE")
    )
    profile_group_id: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)

    # Stat line
    mov_1: Mapped[int] = mapped_column(Integer, default=0)
    mov_2: Mapped[int] = mapped_column(Integer, default=0)
    cc: Mapped[int] = mapped_column(Integer, default=0)
    bs: Mapped[int] = mapped_column(Integer, default=0)
    ph: Mapped[int] = mapped_column(Integer, default=0)
    wip: Mapped[int] = mapped_column(Integer, default=0)
    arm: Mapped[int] = mapped_column(Integer, default=0)
    bts: Mapped[int] = mapped_column(Integer, default=0)
    wounds: Mapped[int] = mapped_column(Integer, default=0)
    silhouette: Mapped[int] = mapped_column(Integer, default=0)
    is_structure: Mapped[bool] = mapped_column(Boolean, default=False)
    unit_type: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Items as JSONB arrays: [{id: 191, extra: [6]}, ...]
    skills_json: Mapped[list[Any]] = mapped_column(JSONB, default=list)
    equipment_json: Mapped[list[Any]] = mapped_column(JSONB, default=list)
    weapons_json: Mapped[list[Any]] = mapped_column(JSONB, default=list)

    # Relationships
    unit: Mapped["Unit"] = relationship(back_populates="profiles")


class Loadout(Base):
    """A unit's equipment option (loadout / variant). Determines points and SWC."""

    __tablename__ = "loadouts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    unit_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("units.id", ondelete="CASCADE")
    )
    profile_group_id: Mapped[int] = mapped_column(Integer, nullable=False)
    option_id: Mapped[int] = mapped_column(
        Integer, nullable=False
    )  # Original option ID from CB
    name: Mapped[str] = mapped_column(String, nullable=False)
    points: Mapped[int] = mapped_column(Integer, nullable=False)
    swc: Mapped[float] = mapped_column(Float, default=0.0)

    # Items added/replaced by this loadout
    skills_json: Mapped[list[Any]] = mapped_column(JSONB, default=list)
    equipment_json: Mapped[list[Any]] = mapped_column(JSONB, default=list)
    weapons_json: Mapped[list[Any]] = mapped_column(JSONB, default=list)

    # Order info (if the loadout provides special orders)
    orders_json: Mapped[list[Any] | None] = mapped_column(JSONB, nullable=True)

    # Relationships
    unit: Mapped["Unit"] = relationship(back_populates="loadouts")
