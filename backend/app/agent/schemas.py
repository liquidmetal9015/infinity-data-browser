from typing import Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ListContextUnit(BaseModel):
    name: str
    isc: str
    loadout: str = ""
    points: int = 0
    swc: float = 0.0


class ChatContext(BaseModel):
    faction_id: int | None = None
    faction_name: str | None = None
    list_points: int | None = None
    list_swc: float | None = None
    list_units: list[ListContextUnit] = Field(default_factory=list)


class ChatRequest(BaseModel):
    message: str = Field(..., max_length=2000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=20)
    context: ChatContext = Field(default_factory=ChatContext)


class ChatResponse(BaseModel):
    reply: str
    tools_used: list[str] = Field(default_factory=list)
    input_tokens: int = 0
    output_tokens: int = 0
