"""FastAPI app for the aigeo Assistant.

Serves:
  /                          -> frontend/index.html
  /<static path>             -> frontend/<path>
  /data/<path>               -> data/<path>
  /api/health                -> small JSON status
  /api/chat                  -> SSE chat endpoint (see chat.py)
  /mcp/                      -> MCP server sidecar (see mcp_server.py)

Replaces the legacy serve.py. Launch with:
  AGENT_SERVER_URL=http://agent_server:7701 uvicorn backend.main:app --port 3388
"""

from __future__ import annotations

import contextlib
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.requests import Request

from .chat import router as chat_router
from .data_loader import get_cache
from .llm import ensure_agent_preset
from .mcp_server import build_session_manager, mcp_lifespan


PROJECT_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIR = PROJECT_ROOT / "frontend"
DATA_DIR = PROJECT_ROOT / "data"


# ---------------------------------------------------------------------------
# Lifespan: warm the data cache and start the MCP session manager
# ---------------------------------------------------------------------------

@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    cache = get_cache()
    app.state.cache_summary = cache.summary()

    # Preset-seed call kept here for the day someone exposes admin/ without
    # oauth2_proxy. Today it always returns ok=False because the admin API on
    # logus2k.com requires Google login; the chat path does NOT depend on the
    # preset (model defaults to "gemma-4", system prompt injected locally).
    app.state.preset_seeded = await ensure_agent_preset()

    manager = build_session_manager()
    app.state.mcp_manager = manager
    async with mcp_lifespan(manager):
        yield


app = FastAPI(title="aigeo Assistant", version="0.1.0", lifespan=lifespan)


# CORS: permissive in dev; tighten in prod.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# Routers
app.include_router(chat_router)


@app.get("/api/health")
async def health() -> dict:
    return {
        "ok": True,
        "agent_server": os.environ.get("AGENT_SERVER_URL", "https://logus2k.com/llm"),
        "agent_name": os.environ.get("AIGEO_AGENT_NAME", "aigeo"),
        "preset_seeded": getattr(app.state, "preset_seeded", None),
        "tools": 8,
        "cache": app.state.cache_summary,
    }


# ---------------------------------------------------------------------------
# MCP mount at /mcp/. The session manager is itself an ASGI app whose
# handle_request is the (scope, receive, send) callable, so we wrap it as a
# tiny ASGI shim and mount it directly. Mount BEFORE the static catch-all so
# /mcp* wins.
# ---------------------------------------------------------------------------

async def _mcp_asgi(scope, receive, send):
    manager = app.state.mcp_manager
    await manager.handle_request(scope, receive, send)


app.mount("/mcp", _mcp_asgi)


# ---------------------------------------------------------------------------
# Static serving (frontend + data) — mounted LAST so /api/* and /mcp/* win.
# ---------------------------------------------------------------------------

@app.get("/")
async def index() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "index.html")


# Data first (more specific path) then static frontend.
app.mount("/data", StaticFiles(directory=DATA_DIR), name="data")
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
