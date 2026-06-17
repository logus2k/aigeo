#!/usr/bin/env bash
# Launch the aigeo Assistant (FastAPI app: static frontend, /api/chat, /mcp/).
# Open: http://localhost:3388/
#
# Requires:
#   - ./.venv with backend/requirements.txt installed
#   - agent_server reachable at AGENT_SERVER_URL (default http://agent_server:7701)
set -e
cd "$(dirname "$0")"

PORT="${1:-3388}"

if [ ! -x ".venv/bin/uvicorn" ]; then
  echo "venv not found or uvicorn missing. Run:" >&2
  echo "  python3 -m venv .venv && .venv/bin/pip install -r backend/requirements.txt" >&2
  exit 1
fi

exec .venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port "$PORT" --reload
