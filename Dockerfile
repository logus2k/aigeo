# aigeo — single FastAPI app serving the frontend, /data, /api/chat and /mcp.
# External AI services (agent_server, tts_server, stt_server) run in their own
# containers and are reached by name over the logus2k_network.
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# 1) Python dependencies — changes rarely, so this layer stays cached.
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# 2) Dataset — baked into an early, stable layer (it changes little). Not a
#    bind mount: the data ships inside the image.
COPY data/ data/

# 3) Application code — changes most often, so it goes last (only these layers
#    rebuild on a code edit; deps + data stay cached).
COPY backend/ backend/
COPY frontend/ frontend/

EXPOSE 3388

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "3388"]
