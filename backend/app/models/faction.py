"""Faction models."""

from sqlalchemy import Boolean, ForeignKey, Integer, String, Table, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

# Association table: which units belong to which factions
unit_factions = Table(
    "unit_factions",
    Base.metadata,
    Column("unit_id", Integer, ForeignKey("units.id", ondelete="CASCADE"), primary_key=True),
    Column("faction_id", Integer, ForeignKey("factions.id", ondelete="CASCADE"), primary_key=True),
)


class Faction(Base):
    __tablename__ = "factions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    parent_id: Mapped[int] = mapped_column(Integer, ForeignKey("factions.id"), nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    discontinued: Mapped[bool] = mapped_column(Boolean, default=False)
    logo: Mapped[str] = mapped_column(String, default="")

    # Relationships
    parent: Mapped["Faction | None"] = relationship(
        "Faction", remote_side="Faction.id", back_populates="children",
    )
    children: Mapped[list["Faction"]] = relationship(
        "Faction", back_populates="parent",
    )
    units: Mapped[list["Unit"]] = relationship(  # noqa: F821
        secondary=unit_factions, back_populates="factions",
    )

    @property
    def is_vanilla(self) -> bool:
        """A vanilla / super-faction has parent_id == id."""
        return self.parent_id == self.id or self.parent_id is None
