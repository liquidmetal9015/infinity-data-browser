"""Fireteam chart model — stored per-faction."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import ForeignKey, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.faction import Faction


class FireteamChart(Base):
    """Fireteam chart for a faction. Stored as structured JSONB since the
    schema is complex and variable (spec, teams with nested unit refs)."""

    __tablename__ = "fireteam_charts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    faction_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("factions.id", ondelete="CASCADE"), unique=True
    )
    # The full fireteam chart structure as JSONB
    # {spec: {CORE: 1, ...}, teams: [{name, type, units, obs}, ...]}
    chart_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)

    faction: Mapped[Faction] = relationship()
