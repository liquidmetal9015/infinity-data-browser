"""Anthropic provider — agentic tool-use loop using the Anthropic Python SDK."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from app.agent.providers.base import AgentResponse

if TYPE_CHECKING:
    from app.agent.tools.executor import ToolExecutor

logger = logging.getLogger(__name__)

MAX_TOOL_ROUNDS = 6


class AnthropicProvider:
    def __init__(self, api_key: str, model: str) -> None:
        import anthropic as _anthropic

        self._client = _anthropic.AsyncAnthropic(api_key=api_key)
        self._model = model

    async def chat(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        system: str,
        executor: ToolExecutor,
    ) -> AgentResponse:
        import anthropic as _anthropic

        tool_calls_made: list[str] = []
        total_input_tokens = 0
        total_output_tokens = 0

        # Wrap tools with Anthropic's ToolParam format
        anthropic_tools = [
            _anthropic.types.ToolParam(
                name=t["name"],
                description=t.get("description", ""),
                input_schema=t["input_schema"],
            )
            for t in tools
        ]

        current_messages = list(messages)

        for _round in range(MAX_TOOL_ROUNDS):
            # Add cache_control to the system prompt (static across all calls)
            response = await self._client.messages.create(
                model=self._model,
                max_tokens=2048,
                system=[
                    {
                        "type": "text",
                        "text": system,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
                tools=anthropic_tools,
                messages=current_messages,
            )

            total_input_tokens += response.usage.input_tokens
            total_output_tokens += response.usage.output_tokens

            if response.stop_reason != "tool_use":
                # Extract final text response
                text = ""
                for block in response.content:
                    if hasattr(block, "text"):
                        text += block.text
                return AgentResponse(
                    text=text,
                    tool_calls_made=tool_calls_made,
                    input_tokens=total_input_tokens,
                    output_tokens=total_output_tokens,
                )

            # Execute all tool calls in this round
            tool_results = []
            for block in response.content:
                if block.type != "tool_use":
                    continue

                tool_calls_made.append(block.name)
                logger.debug("Tool call: %s(%s)", block.name, block.input)

                result_content = await executor.execute(block.name, dict(block.input))

                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result_content,
                    }
                )

            # Append assistant response + tool results to conversation
            current_messages = current_messages + [
                {"role": "assistant", "content": response.content},
                {"role": "user", "content": tool_results},
            ]

        # Hit max rounds — return whatever text we have
        logger.warning("Reached max tool rounds (%d)", MAX_TOOL_ROUNDS)
        return AgentResponse(
            text="I reached the maximum number of steps. Please try a more focused question.",
            tool_calls_made=tool_calls_made,
            input_tokens=total_input_tokens,
            output_tokens=total_output_tokens,
        )
