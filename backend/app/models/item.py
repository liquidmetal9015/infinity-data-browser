"""Item catalog models — weapons, skills, equipment, ammunition.

These are the reference/lookup tables. The actual assignments of items
to profiles/loadouts are stored as JSONB arrays on those models.
"""

from sqlalchemy import Integer, String, Float
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Weapon(Base):
    __tablename__ = "weapons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False, index=True)
    wiki_url: Mapped[str | None] = mapped_column(String, nullable=True)
    weapon_type: Mapped[str | None] = mapped_column(String, nullable=True)
    burst: Mapped[str | None] = mapped_column(String, nullable=True)
    damage: Mapped[str | None] = mapped_column(String, nullable=True)
    saving: Mapped[str | None] = mapped_column(String, nullable=True)
    saving_num: Mapped[str | None] = mapped_column(String, nullable=True)
    ammunition_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    properties: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    # Range bands stored as JSON: {short: {max, mod}, med: {max, mod}, ...}
    distance: Mapped[dict | None] = mapped_column(JSONB, nullable=True)


class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False, index=True)
    wiki_url: Mapped[str | None] = mapped_column(String, nullable=True)


class Equipment(Base):
    __tablename__ = "equipment"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False, index=True)
    wiki_url: Mapped[str | None] = mapped_column(String, nullable=True)


class Ammunition(Base):
    __tablename__ = "ammunitions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False, index=True)
    wiki_url: Mapped[str | None] = mapped_column(String, nullable=True)
