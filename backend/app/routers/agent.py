"""Agent chat endpoint — LLM-powered assistant for list building and game queries."""

from __future__ import annotations

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.agent import InfinityAgent
from app.agent.game_data.loader import GameDataLoader
from app.agent.schemas import ChatRequest, ChatResponse
from app.auth import get_current_user
from app.config import settings
from app.database import get_session
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/agent", tags=["agent"])


def _get_provider():
    provider_name = settings.llm_provider.lower()
    if provider_name == "anthropic":
        if not settings.anthropic_api_key:
            raise HTTPException(
                status_code=503,
                detail="AI features are not configured (missing API key).",
            )
        from app.agent.providers.anthropic import AnthropicProvider

        return AnthropicProvider(
            api_key=settings.anthropic_api_key,
            model=settings.llm_model,
        )
    elif provider_name == "gemini":
        from app.agent.providers.gemini import GeminiProvider

        return GeminiProvider()
    else:
        raise HTTPException(
            status_code=503,
            detail=f"Unknown LLM provider: {provider_name}",
        )


async def _check_and_increment_usage(user_id: str, db: AsyncSession) -> None:
    year_month = datetime.now().strftime("%Y-%m")
    result = await db.execute(
        text(
            """
            INSERT INTO ai_usage (user_id, year_month, message_count)
            VALUES (:user_id, :year_month, 1)
            ON CONFLICT (user_id, year_month)
            DO UPDATE SET message_count = ai_usage.message_count + 1,
                          last_used = NOW()
            RETURNING message_count
            """
        ),
        {"user_id": user_id, "year_month": year_month},
    )
    await db.commit()
    count = result.scalar_one()
    if count > settings.ai_monthly_limit:
        raise HTTPException(
            status_code=429,
            detail=(
                f"Monthly AI message limit reached ({settings.ai_monthly_limit} messages). "
                "Limit resets at the start of next month."
            ),
        )


@router.post("/chat")
async def chat(
    request: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> ChatResponse:
    """Chat with the Infinity AI assistant. Requires authentication."""
    await _check_and_increment_usage(user.id, db)

    loader = GameDataLoader.get_instance()
    provider = _get_provider()
    agent = InfinityAgent(provider=provider, loader=loader)

    try:
        response = await agent.chat(
            message=request.message,
            history=request.history,
            context=request.context,
            db=db,
        )
    except Exception as e:
        logger.exception("Agent chat failed for user %s: %s", user.id, e)
        raise HTTPException(
            status_code=500, detail="AI assistant encountered an error."
        ) from e

    return ChatResponse(
        reply=response.text,
        tools_used=response.tool_calls_made,
        input_tokens=response.input_tokens,
        output_tokens=response.output_tokens,
    )
