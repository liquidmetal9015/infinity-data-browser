"""InfinityAgent — orchestrates provider + tools for a single chat turn."""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.game_data.loader import GameDataLoader
from app.agent.providers.base import AgentResponse, LLMProvider
from app.agent.schemas import ChatContext, ChatMessage
from app.agent.tools.definitions import TOOL_DEFINITIONS
from app.agent.tools.executor import ToolExecutor

_SYSTEM_PROMPT_BASE = """\
You are an expert assistant for the miniature wargame Infinity (N5 rules) by Corvus Belli.
You help players build army lists, understand game mechanics, analyze combat matchups, \
and optimize strategies.

Guidelines:
- Use tools to look up unit stats, fireteam rules, and game data before answering — \
  do not rely on training data for specific numbers
- Keep answers concise and tactical — players want actionable advice
- When suggesting units, always mention their points cost and key capabilities
- For combat analysis, always note the key factors (range band, cover, ARM values)
- If you don't have enough information, ask a clarifying question
"""


class InfinityAgent:
    def __init__(self, provider: LLMProvider, loader: GameDataLoader) -> None:
        self._provider = provider
        self._loader = loader

    def _build_system_prompt(self, context: ChatContext) -> str:
        parts = [_SYSTEM_PROMPT_BASE]

        if context.faction_name:
            parts.append(
                f"\nThe player is currently building a {context.faction_name} list."
            )

        if context.list_points is not None:
            parts.append(f"List total: {context.list_points} pts.")

        if context.list_units:
            unit_lines = ", ".join(
                f"{u.name} ({u.points}pts)" for u in context.list_units
            )
            parts.append(f"Current units in list: {unit_lines}.")

        if context.faction_id:
            parts.append(
                f"Faction ID for tool calls: {context.faction_id}. "
                "Use this when faction_id is required by a tool."
            )

        return "\n".join(parts)

    @staticmethod
    def _format_history(history: list[ChatMessage]) -> list[dict[str, Any]]:
        return [{"role": m.role, "content": m.content} for m in history]

    async def chat(
        self,
        message: str,
        history: list[ChatMessage],
        context: ChatContext,
        db: AsyncSession,
    ) -> AgentResponse:
        executor = ToolExecutor(db=db, loader=self._loader)
        system = self._build_system_prompt(context)
        messages = self._format_history(history) + [
            {"role": "user", "content": message}
        ]
        return await self._provider.chat(messages, TOOL_DEFINITIONS, system, executor)
