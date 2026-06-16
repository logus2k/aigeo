#!/usr/bin/env python3
"""Static server for aigeo.

Serves the app at the web root so http://localhost:PORT/ returns
frontend/index.html (no /frontend/ segment needed). Requests under /data/ are
mapped to the project's data/ directory (which lives outside frontend/).
"""
import http.server
import os
import sys
import urllib.parse

ROOT = os.path.dirname(os.path.abspath(__file__))
FRONTEND = os.path.join(ROOT, "frontend")
DATA = os.path.join(ROOT, "data")


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        path = path.split("?", 1)[0].split("#", 1)[0]
        path = urllib.parse.unquote(path)
        parts = [p for p in path.split("/") if p not in ("", ".", "..")]
        if parts and parts[0] == "data":          # /data/... -> project data dir
            return os.path.join(DATA, *parts[1:])
        return os.path.join(FRONTEND, *parts)      # everything else -> frontend/


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3388
    httpd = http.server.HTTPServer(("", port), Handler)
    print(f"Serving aigeo at http://localhost:{port}/")
    httpd.serve_forever()
