"""MCP server sidecar exposing the same 8 ANIA tools as the chat backend.

Mounted into the FastAPI app at /mcp/ via StreamableHTTPSessionManager so any
external MCP client (claude-code, whatsapp_agent, etc.) can list and call
these tools over HTTP Streamable JSON-RPC 2.0.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from mcp.server.lowlevel import Server
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
from mcp.types import TextContent, Tool

from .tool_schemas import TOOL_SCHEMAS
from .tools import call_tool


SERVER_NAME = "aigeo-ania"
SERVER_VERSION = "0.1.0"


def build_mcp_server() -> Server:
    server = Server(SERVER_NAME, version=SERVER_VERSION)

    @server.list_tools()
    async def list_tools() -> list[Tool]:
        return [
            Tool(
                name=s["name"],
                description=s["description"],
                inputSchema=s["input_schema"],
            )
            for s in TOOL_SCHEMAS.values()
        ]

    @server.call_tool()
    async def handle_call(name: str, arguments: dict) -> list[TextContent]:
        try:
            result = await call_tool(name, arguments or {})
        except Exception as exc:  # noqa: BLE001
            return [TextContent(type="text", text=f"Error: {type(exc).__name__}: {exc}")]
        return [TextContent(type="text", text=result)]

    return server


def build_session_manager() -> StreamableHTTPSessionManager:
    server = build_mcp_server()
    return StreamableHTTPSessionManager(app=server, json_response=False, stateless=True)


@asynccontextmanager
async def mcp_lifespan(manager: StreamableHTTPSessionManager):
    """Lifespan ctx for StreamableHTTPSessionManager (required to start its task group)."""
    async with manager.run():
        yield
