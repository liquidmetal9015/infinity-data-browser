from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import ARRAY, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.faction import Faction
    from app.models.user import User


class ArmyList(Base):
    __tablename__ = "army_lists"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    faction_id: Mapped[int] = mapped_column(ForeignKey("factions.id"))
    name: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), server_default="{}")
    points: Mapped[int] = mapped_column(Integer)
    swc: Mapped[float] = mapped_column(Float)

    # Store the entire frontend Army List JSON here to avoid complex relationships
    units_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User] = relationship(back_populates="lists")
    faction: Mapped[Faction] = relationship()

    @property
    def unit_count(self) -> int:
        """Count non-peripheral units across all combat groups."""
        groups = self.units_json.get("groups", []) if self.units_json else []
        return sum(
            1
            for group in groups
            for unit in group.get("units", [])
            if not unit.get("isPeripheral", False)
        )
