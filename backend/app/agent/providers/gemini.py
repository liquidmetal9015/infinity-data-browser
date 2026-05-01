from __future__ import annotations

from typing import Any

from app.agent.providers.base import AgentResponse


class GeminiProvider:
    async def chat(self, *args: Any, **kwargs: Any) -> AgentResponse:
        raise NotImplementedError("Gemini provider is not yet implemented")
