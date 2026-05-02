"""GameDataLoader — singleton that loads static game data files once at startup."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, ClassVar


class GameDataLoader:
    _instance: ClassVar[GameDataLoader | None] = None

    def __init__(self) -> None:
        self._data_dir: Path | None = None
        self.metadata: dict[str, Any] = {}
        self.classifieds: list[dict[str, Any]] = []
        self.rule_summaries: dict[str, Any] = {}
        self._wiki_pages: dict[str, str] | None = None
        self._initialized = False

    @classmethod
    def get_instance(cls) -> GameDataLoader:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def initialize(self, data_dir: str | Path) -> None:
        if self._initialized:
            return
        self._data_dir = Path(data_dir)
        self._load_metadata()
        self._load_classifieds()
        self._load_rule_summaries()
        self._initialized = True

    def _load_metadata(self) -> None:
        path = self._data_dir / "processed" / "metadata.json"
        if path.exists():
            self.metadata = json.loads(path.read_text())

    def _load_classifieds(self) -> None:
        path = self._data_dir / "classifieds.json"
        if path.exists():
            self.classifieds = json.loads(path.read_text())

    def _load_rule_summaries(self) -> None:
        path = self._data_dir / "rule_summaries.json"
        if path.exists():
            self.rule_summaries = json.loads(path.read_text())

    def get_wiki_pages(self) -> dict[str, str]:
        if self._wiki_pages is None:
            self._wiki_pages = {}
            wiki_dir = self._data_dir / "wiki" if self._data_dir else None
            if wiki_dir and wiki_dir.exists():
                for f in wiki_dir.glob("*.md"):
                    self._wiki_pages[f.stem] = f.read_text()
        return self._wiki_pages

    def get_weapon_name(self, weapon_id: int) -> str:
        for w in self.metadata.get("weapons", []):
            if w.get("id") == weapon_id:
                return w.get("name", str(weapon_id))
        return str(weapon_id)

    def get_skill_name(self, skill_id: int) -> str:
        for s in self.metadata.get("skills", []):
            if s.get("id") == skill_id:
                return s.get("name", str(skill_id))
        return str(skill_id)

    def get_equipment_name(self, equip_id: int) -> str:
        for e in self.metadata.get("equipment", []):
            if e.get("id") == equip_id:
                return e.get("name", str(equip_id))
        return str(equip_id)

    def get_skill_summary(self, skill_name: str) -> str | None:
        skills = self.rule_summaries.get("skills", {})
        return skills.get(skill_name)

    def get_equipment_summary(self, equip_name: str) -> str | None:
        equipment = self.rule_summaries.get("equipment", {})
        return equipment.get(equip_name)
