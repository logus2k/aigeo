"""agent_server streaming client with OpenAI tool-call loop.

Adapted from noted's `app/managers/llm_manager.py` + `app/routers/llm.py`
tool-call collection logic. Calls Gemma-4 via agent_server's
OpenAI-compatible /v1/chat/completions endpoint and loops on
`finish_reason == "tool_calls"` until `stop`.
"""

from __future__ import annotations

import json
import os
from collections.abc import AsyncIterator
from pathlib import Path

import httpx

from .tool_schemas import openai_tools
from .tools import call_tool


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

AGENT_SERVER_URL = os.environ.get("AGENT_SERVER_URL", "https://logus2k.com/llm")
# `model` parameter sent to agent_server. The `aigeo` preset lives at
# ~/env/assets/agent_server/data/agents/aigeo.agent.json with its
# system prompt at data/prompts/aigeo_system_prompt.txt. agent_server
# applies the preset's system prompt and sampling automatically when this
# name is passed as `model`. Matches cv/noted/job2cool pattern (Option A1
# in agent_server/documents/how_to.md). Falls back to gemma-4 only if the
# preset is missing.
AIGEO_AGENT_NAME = os.environ.get("AIGEO_AGENT_NAME", "aigeo")
DEFAULT_MAX_TOKENS = int(os.environ.get("AIGEO_MAX_TOKENS", "4096"))
DEFAULT_TEMPERATURE = float(os.environ.get("AIGEO_TEMPERATURE", "0.4"))
REQUEST_TIMEOUT = float(os.environ.get("AIGEO_REQUEST_TIMEOUT", "240"))
MAX_AGENTIC_ITERATIONS = 10

SYSTEM_PROMPT_PATH = Path(__file__).resolve().parent / "system_prompt.md"

_SYSTEM_PROMPT: str | None = None


def get_system_prompt() -> str:
    global _SYSTEM_PROMPT  # noqa: PLW0603
    if _SYSTEM_PROMPT is None:
        _SYSTEM_PROMPT = SYSTEM_PROMPT_PATH.read_text(encoding="utf-8")
    return _SYSTEM_PROMPT


# ---------------------------------------------------------------------------
# Streaming chat with tool-use loop
# ---------------------------------------------------------------------------

async def ensure_agent_preset(client: httpx.AsyncClient | None = None) -> dict:
    """Idempotently seed the `aigeo` preset on agent_server with the local
    system_prompt.md. Never overwrites edits made via the Agents UI: if the
    preset already exists, leaves it alone.

    Returns a dict describing the outcome:
      {"ok": True, "action": "exists"}                       preset already there
      {"ok": True, "action": "created"}                      we created it
      {"ok": False, "status": int, "body": str}              admin API rejected us
      {"ok": False, "error": "...", "exc": "..."}            network error

    Pattern lifted from job2cool/backend/services.py:ensure_agent_preset, but
    we surface the failure mode instead of swallowing it (job2cool runs on the
    same host as agent_server and never sees auth errors; aigeo may go through
    a reverse proxy that does not expose the admin API).
    """
    own_client = client is None
    if own_client:
        client = httpx.AsyncClient(timeout=REQUEST_TIMEOUT)
    try:
        # 1. Does the preset already exist?
        try:
            r = await client.get(
                f"{AGENT_SERVER_URL}/admin/api/agents/{AIGEO_AGENT_NAME}",
                timeout=5,
            )
            if r.status_code == 200:
                return {"ok": True, "action": "exists"}
        except httpx.HTTPError as exc:
            return {"ok": False, "error": "GET failed", "exc": f"{type(exc).__name__}: {exc}"}

        # 2. Create it.
        try:
            r = await client.post(
                f"{AGENT_SERVER_URL}/admin/api/agents",
                json={"name": AIGEO_AGENT_NAME, "system_prompt": get_system_prompt()},
                timeout=10,
            )
            if r.status_code in (200, 201):
                return {"ok": True, "action": "created"}
            body = r.text[:300]
            return {"ok": False, "status": r.status_code, "body": body}
        except httpx.HTTPError as exc:
            return {"ok": False, "error": "POST failed", "exc": f"{type(exc).__name__}: {exc}"}
    finally:
        if own_client:
            await client.aclose()


async def stream_chat(
    messages: list[dict],
    model: str | None = None,
    max_tokens: int | None = None,
    temperature: float | None = None,
) -> AsyncIterator[dict]:
    """Stream Gemma-4 responses via agent_server, looping on tool calls.

    Yields one dict per SSE event for the chat endpoint:
      {"type": "delta", "text": "..."}
      {"type": "tool_call_start", "tool": "...", "input": {...}, "call_id": "..."}
      {"type": "tool_call_result", "call_id": "...", "ok": bool, "content_preview": "..."}
      {"type": "done", "stop_reason": "...", "input_tokens": N, "output_tokens": N}
      {"type": "error", "message": "..."}
    """
    model = model or AIGEO_AGENT_NAME
    max_tokens = max_tokens or DEFAULT_MAX_TOKENS
    temperature = temperature if temperature is not None else DEFAULT_TEMPERATURE
    tools = openai_tools()

    # The `aigeo` preset on agent_server owns the system prompt and sampling
    # (per agent_server/documents/how_to.md Option A1). Pass user/assistant
    # turns only; agent_server prepends the preset's system prompt server-side.
    working: list[dict] = list(messages)

    total_in = 0
    total_out = 0

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        for _iteration in range(MAX_AGENTIC_ITERATIONS):
            assistant_text_parts: list[str] = []
            # tool_call accumulator keyed by choice-delta index
            tool_calls_by_index: dict[int, dict] = {}
            finish_reason: str | None = None
            had_error = False

            try:
                async with client.stream(
                    "POST",
                    f"{AGENT_SERVER_URL}/v1/chat/completions",
                    json={
                        "model": model,
                        "messages": working,
                        "stream": True,
                        "temperature": temperature,
                        "max_tokens": max_tokens,
                        "tools": tools,
                    },
                ) as resp:
                    if resp.status_code != 200:
                        body = (await resp.aread()).decode("utf-8", errors="replace")
                        yield {"type": "error", "message": f"agent_server {resp.status_code}: {body[:200]}"}
                        return
                    async for line in resp.aiter_lines():
                        if not line or not line.startswith("data:"):
                            continue
                        data_str = line[5:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            obj = json.loads(data_str)
                        except json.JSONDecodeError:
                            continue

                        # Token usage (some upstreams attach usage to the final chunk)
                        usage = obj.get("usage")
                        if usage:
                            total_in += usage.get("prompt_tokens", 0) or 0
                            total_out += usage.get("completion_tokens", 0) or 0

                        choices = obj.get("choices") or []
                        if not choices:
                            continue
                        choice = choices[0]
                        delta = choice.get("delta") or {}

                        # Plain text delta
                        text_delta = delta.get("content")
                        if text_delta:
                            assistant_text_parts.append(text_delta)
                            yield {"type": "delta", "text": text_delta}

                        # OpenAI tool_calls deltas: accumulate by index
                        tcs = delta.get("tool_calls") or []
                        for tc in tcs:
                            idx = tc.get("index", 0)
                            if idx not in tool_calls_by_index:
                                tool_calls_by_index[idx] = {
                                    "id": tc.get("id") or "",
                                    "name": "",
                                    "arguments_parts": [],
                                }
                            entry = tool_calls_by_index[idx]
                            if tc.get("id") and not entry["id"]:
                                entry["id"] = tc["id"]
                            fn = tc.get("function") or {}
                            if fn.get("name") and not entry["name"]:
                                entry["name"] = fn["name"]
                            if fn.get("arguments"):
                                entry["arguments_parts"].append(fn["arguments"])

                        fr = choice.get("finish_reason")
                        if fr is not None:
                            finish_reason = fr

            except httpx.HTTPError as exc:
                # Connection/timeout to the agent_server => report it as unavailable
                # rather than leaking a raw transport error.
                if isinstance(exc, httpx.TransportError):
                    yield {"type": "error", "message":
                           "Agent Server (https://github.com/logus2k/agent_server) "
                           "not found or not available."}
                else:
                    yield {"type": "error", "message": f"HTTP error: {type(exc).__name__}: {exc}"}
                return
            except Exception as exc:  # noqa: BLE001
                yield {"type": "error", "message": f"{type(exc).__name__}: {exc}"}
                return

            # If the model emitted tool calls, execute and loop.
            if tool_calls_by_index:
                executed_calls: list[dict] = []
                for idx in sorted(tool_calls_by_index):
                    entry = tool_calls_by_index[idx]
                    name = entry["name"]
                    call_id = entry["id"] or f"call_{idx}"
                    arg_str = "".join(entry["arguments_parts"]) or "{}"
                    try:
                        args = json.loads(arg_str) if arg_str.strip() else {}
                    except json.JSONDecodeError:
                        args = {}

                    yield {
                        "type": "tool_call_start",
                        "call_id": call_id,
                        "tool": name,
                        "input": args,
                    }

                    try:
                        result = await call_tool(name, args)
                        ok = True
                    except Exception as exc:  # noqa: BLE001
                        result = f"Error: {type(exc).__name__}: {exc}"
                        ok = False
                    preview = result[:600] + ("..." if len(result) > 600 else "")
                    yield {
                        "type": "tool_call_result",
                        "call_id": call_id,
                        "ok": ok,
                        "content_preview": preview,
                    }
                    executed_calls.append({
                        "id": call_id,
                        "name": name,
                        "arguments": arg_str,
                        "result": result,
                    })

                # Append the assistant turn (in OpenAI shape) with tool_calls
                assistant_text = "".join(assistant_text_parts)
                working.append({
                    "role": "assistant",
                    "content": assistant_text if assistant_text else None,
                    "tool_calls": [
                        {
                            "id": c["id"],
                            "type": "function",
                            "function": {"name": c["name"], "arguments": c["arguments"]},
                        }
                        for c in executed_calls
                    ],
                })
                # Append one tool message per call (OpenAI requires role:"tool")
                for c in executed_calls:
                    working.append({
                        "role": "tool",
                        "tool_call_id": c["id"],
                        "content": c["result"],
                    })
                # Loop again with the tool results in context
                continue

            # No tool calls -> the assistant finished its turn
            yield {
                "type": "done",
                "stop_reason": finish_reason or "stop",
                "input_tokens": total_in,
                "output_tokens": total_out,
            }
            return

    # Safety: hit the iteration cap
    yield {
        "type": "error",
        "message": f"Agentic loop exceeded {MAX_AGENTIC_ITERATIONS} iterations; aborting.",
    }
