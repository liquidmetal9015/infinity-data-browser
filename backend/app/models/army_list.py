from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ArmyList(Base):
    __tablename__ = "army_lists"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    faction_id: Mapped[int] = mapped_column(ForeignKey("factions.id"))
    name: Mapped[str] = mapped_column(String)
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

    user: Mapped["User"] = relationship(back_populates="lists")
    faction: Mapped["Faction"] = relationship()
