"""MCP server round-trip: list_tools returns 8, call_tool returns content."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.mcp_server import build_mcp_server  # noqa: E402


@pytest.mark.asyncio
async def test_list_tools_returns_8():
    server = build_mcp_server()
    handler = server.request_handlers.get(__import__("mcp").types.ListToolsRequest)
    assert handler is not None, "list_tools handler not registered"

    # The decorator wraps the handler; call it via the registered async handler
    from mcp.types import ListToolsRequest
    req = ListToolsRequest(method="tools/list", params=None)
    result = await handler(req)
    tools = result.root.tools
    assert len(tools) == 8
    names = {t.name for t in tools}
    assert names == {
        "list_countries", "list_indicators", "get_country_profile",
        "get_indicator_explainer", "get_country_source_summary",
        "compare_countries", "query_scores", "get_rubric_section",
    }


@pytest.mark.asyncio
async def test_call_tool_list_countries():
    server = build_mcp_server()
    from mcp.types import CallToolRequest, CallToolRequestParams
    handler = server.request_handlers.get(CallToolRequest)
    assert handler is not None, "call_tool handler not registered"

    req = CallToolRequest(
        method="tools/call",
        params=CallToolRequestParams(name="list_countries", arguments={}),
    )
    result = await handler(req)
    contents = result.root.content
    assert len(contents) == 1
    payload = json.loads(contents[0].text)
    assert len(payload) == 23


@pytest.mark.asyncio
async def test_call_tool_unknown_returns_error_text():
    server = build_mcp_server()
    from mcp.types import CallToolRequest, CallToolRequestParams
    handler = server.request_handlers.get(CallToolRequest)
    req = CallToolRequest(
        method="tools/call",
        params=CallToolRequestParams(name="not_a_tool", arguments={}),
    )
    result = await handler(req)
    contents = result.root.content
    assert "Error" in contents[0].text
