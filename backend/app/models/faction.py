"""Faction models."""

from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

# Association table: which units belong to which factions
unit_factions = Table(
    "unit_factions",
    Base.metadata,
    Column(
        "unit_id", Integer, ForeignKey("units.id", ondelete="CASCADE"), primary_key=True
    ),
    Column(
        "faction_id",
        Integer,
        ForeignKey("factions.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Faction(Base):
    __tablename__ = "factions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # parent_id is NOT a FK — CB data has phantom parent IDs that don't exist in
    # the factions table (e.g. faction 199 has parent=191, but 191 is not in metadata).
    # We store it as a plain nullable int and use it for grouping in application code only.
    parent_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    discontinued: Mapped[bool] = mapped_column(Boolean, default=False)
    logo: Mapped[str] = mapped_column(String, default="")

    units: Mapped[list["Unit"]] = relationship(  # noqa: F821
        secondary=unit_factions,
        back_populates="factions",
    )

    @property
    def is_vanilla(self) -> bool:
        """A vanilla / super-faction has parent_id == id (or no parent)."""
        return self.parent_id is None or self.parent_id == self.id
