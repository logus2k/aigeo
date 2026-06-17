"""SSE chat endpoint at /api/chat.

Wraps llm.stream_chat into a text/event-stream HTTP response. Each yielded
dict becomes one SSE event line `data: <json>\n\n`.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from .llm import stream_chat


router = APIRouter()


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: Any  # str for plain user turns; list[dict] when echoing tool-use turns back


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    model: str | None = None
    stream: bool = True


async def _sse_iterator(req: ChatRequest) -> AsyncIterator[bytes]:
    msgs = [m.model_dump() for m in req.messages]
    async for event in stream_chat(messages=msgs, model=req.model):
        line = f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        yield line.encode("utf-8")


@router.post("/api/chat")
async def chat(req: ChatRequest) -> StreamingResponse:
    if not req.messages or req.messages[-1].role != "user":
        return StreamingResponse(
            iter([b'data: {"type":"error","message":"Last message must be user."}\n\n']),
            media_type="text/event-stream",
        )
    return StreamingResponse(
        _sse_iterator(req),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
