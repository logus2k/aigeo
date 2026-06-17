"""Chat endpoint round-trip with a mocked agent_server HTTP stream."""

from __future__ import annotations

import json
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

import httpx
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend import llm  # noqa: E402


# ---------------------------------------------------------------------------
# Build a fake SSE byte stream the way agent_server emits it
# ---------------------------------------------------------------------------

def _sse(payload: dict) -> bytes:
    return f"data: {json.dumps(payload)}\n\n".encode("utf-8")


def _text_only_stream() -> bytes:
    return b"".join([
        _sse({"choices": [{"delta": {"content": "Hello "}, "finish_reason": None}]}),
        _sse({"choices": [{"delta": {"content": "world."}, "finish_reason": None}]}),
        _sse({"choices": [{"delta": {}, "finish_reason": "stop"}],
              "usage": {"prompt_tokens": 17, "completion_tokens": 42}}),
        b"data: [DONE]\n\n",
    ])


def _tool_call_then_text_stream(tool_name: str, tool_input: dict, follow_text: str) -> tuple[bytes, bytes]:
    """Two streams: first emits a tool_call, second emits the follow-up text."""
    args = json.dumps(tool_input)
    first = b"".join([
        _sse({"choices": [{"delta": {"tool_calls": [{
            "index": 0, "id": "call_abc", "type": "function",
            "function": {"name": tool_name, "arguments": ""},
        }]}, "finish_reason": None}]}),
        _sse({"choices": [{"delta": {"tool_calls": [{
            "index": 0, "function": {"arguments": args},
        }]}, "finish_reason": None}]}),
        _sse({"choices": [{"delta": {}, "finish_reason": "tool_calls"}]}),
        b"data: [DONE]\n\n",
    ])
    second = b"".join([
        _sse({"choices": [{"delta": {"content": follow_text}, "finish_reason": None}]}),
        _sse({"choices": [{"delta": {}, "finish_reason": "stop"}]}),
        b"data: [DONE]\n\n",
    ])
    return first, second


# ---------------------------------------------------------------------------
# Mock httpx.AsyncClient that replays a queue of canned responses
# ---------------------------------------------------------------------------

class _CannedResponse:
    def __init__(self, body: bytes, status_code: int = 200):
        self._body = body
        self.status_code = status_code

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def aread(self):
        return self._body

    async def aiter_lines(self):
        for line in self._body.decode("utf-8").splitlines():
            yield line


class FakeClient:
    def __init__(self, bodies: list[bytes]):
        self._queue = list(bodies)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    def stream(self, method: str, url: str, **_kwargs):
        if not self._queue:
            raise RuntimeError("No more canned responses")
        body = self._queue.pop(0)
        return _CannedResponse(body)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_stream_chat_text_only(monkeypatch):
    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **k: FakeClient([_text_only_stream()]))
    events = []
    async for ev in llm.stream_chat(messages=[{"role": "user", "content": "Hi"}]):
        events.append(ev)
    types = [e["type"] for e in events]
    assert types == ["delta", "delta", "done"]
    assert events[0]["text"] == "Hello "
    assert events[1]["text"] == "world."
    assert events[2]["stop_reason"] == "stop"
    assert events[2]["input_tokens"] == 17
    assert events[2]["output_tokens"] == 42


@pytest.mark.asyncio
async def test_stream_chat_tool_call_loop(monkeypatch):
    first, second = _tool_call_then_text_stream(
        "list_countries", {}, "We have 23 countries."
    )
    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **k: FakeClient([first, second]))
    events = []
    async for ev in llm.stream_chat(messages=[{"role": "user", "content": "List."}]):
        events.append(ev)
    types = [e["type"] for e in events]
    # Expect: tool_call_start, tool_call_result, delta(follow text), done
    assert types == ["tool_call_start", "tool_call_result", "delta", "done"]
    assert events[0]["tool"] == "list_countries"
    assert events[0]["call_id"] == "call_abc"
    assert events[1]["ok"] is True
    assert "Portugal" in events[1]["content_preview"]
    assert events[2]["text"] == "We have 23 countries."


@pytest.mark.asyncio
async def test_stream_chat_error_on_non_200(monkeypatch):
    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **k: FakeClient([b'{"error":"oops"}']))
    # Patch the canned response to have status_code != 200
    orig = FakeClient.stream

    def stream_with_500(self, method, url, **kw):
        body = self._queue.pop(0)
        return _CannedResponse(body, status_code=500)

    monkeypatch.setattr(FakeClient, "stream", stream_with_500)
    events = []
    async for ev in llm.stream_chat(messages=[{"role": "user", "content": "Hi"}]):
        events.append(ev)
    assert any(e["type"] == "error" and "agent_server 500" in e["message"] for e in events)
