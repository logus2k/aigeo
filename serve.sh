#!/usr/bin/env bash
# Serve the aigeo app. Open: http://localhost:3388/
set -e
cd "$(dirname "$0")"
exec python3 serve.py "${1:-3388}"
