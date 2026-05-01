from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Protocol

if TYPE_CHECKING:
    from app.agent.tools.executor import ToolExecutor


@dataclass
class AgentResponse:
    text: str
    tool_calls_made: list[str] = field(default_factory=list)
    input_tokens: int = 0
    output_tokens: int = 0


class LLMProvider(Protocol):
    async def chat(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        system: str,
        executor: ToolExecutor,
    ) -> AgentResponse: ...
