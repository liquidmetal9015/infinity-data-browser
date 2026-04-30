from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.army_list import ArmyList


class User(Base):
    __tablename__ = "users"

    # We use string for ID because Firebase UID is a string
    id: Mapped[str] = mapped_column(String, primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    lists: Mapped[list[ArmyList]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
