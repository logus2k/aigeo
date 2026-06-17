# aigeo Assistant: technical architecture

Status: draft for implementation lock-in. Read this end-to-end before opening any code file. Every decision below is recorded with a one-line rationale; if the rationale no longer holds, flag and revise before changing the implementation.

## 1. Purpose

Add a floating-panel conversational Assistant to the existing `aigeo` SVG choropleth map. The Assistant is grounded on the ANIA Assessment Report v2 dataset that already lives under `~/env/assets/aigeo/data/ai_agendas/` (101 files: 24 indicator JSONs, 23 country profile MDs, 24 indicator explainer MDs, 23 rich source summaries, comparator matrix, dataset rubric/CSV/notes, and the v2 report). The Assistant answers user questions about national AI agendas and reacts to map clicks; map clicks update the chat context, and chat answers update map state where appropriate (a tool call to focus a country re-centres the SVG; a tool call to switch indicator re-renders the choropleth).

## 2. Scope

In scope: backend chat service, MCP server (sidecar), tool implementations, frontend floating panel, SSE streaming, chat-to-map binding, system prompt, dev-deploy. Out of scope (defer): authentication, multi-user session persistence, voice input/output, RAG over external corpora, fine-tuning, full production hardening (rate limits, logging infra, monitoring).

## 3. Patterns adopted from reference projects

Three reference projects were scanned and the patterns to copy are explicit.

**From `~/env/assets/cv` (the closest visual analog).** Floating-panel widget pattern (`widget/cv-chat.js`): jsPanel-based collapsible right-side dock toggled from a launcher button; SSE consumer via Fetch+ReadableStream; per-token delta rendering into a chat-bubble div; client-side parsing of in-band markers (cv uses `<think>...</think>` and `<voice>...</voice>` for collapsible details). Files worth reading: `cv/widget/cv-chat.js`, `cv/widget/cv-chat.css`, `cv/backend/main.py`.

**From `~/env/assets/job2cool`.** MCP-client wiring pattern (`backend/main.py:827-857`): backend acts as proxy holding the MCP-server token; browser never sees the secret. Generic LLM-call wrapper (`backend/services.py`) with retry, streaming, and system-prompt caching. We adopt the proxy pattern; we do not adopt the multi-model orchestrator (overkill for our use case).

**From `~/env/assets/noted/backend/app/mcp` and `~/env/assets/noted/noted-rag/app`.** MCP server pattern (`server.py`, `mount.py`): low-level `mcp` SDK with HTTP Streamable transport mounted into FastAPI at `/mcp/`. Anthropic streaming client pattern (`anthropic_llm_manager.py`): aiohttp POST to `https://api.anthropic.com/v1/messages` with SSE parsing into delta events. We adopt both patterns directly.

**Patterns NOT adopted.** noted-rag's RAG layer (ChromaDB plus bge-m3 embeddings) is overkill for 23 countries times 47 MDs at ~5-15 KB each: the LLM can keep the relevant profile and indicator MDs entirely in context per turn. Multi-LLM orchestrator chains (job2cool's router-intro-offer-composer-judge) add complexity without payoff for our query class.

## 4. Stack decisions (locked unless rationale below is invalidated)

| Decision | Choice | One-line rationale |
|---|---|---|
| Frontend chat panel | jsPanel (already vendored in aigeo at `frontend/vendor/jspanel/`) | Same library aigeo already uses for settings, legend, indicators, projections; zero new deps. |
| Frontend chat client | Vanilla JS, single module file `frontend/js/chat.js` | Matches aigeo's no-framework convention and `cv-chat.js` precedent. |
| Streaming protocol | Server-Sent Events (SSE) over Fetch+ReadableStream | Simpler than Socket.IO; matches cv pattern; browser-native; works through any HTTP proxy. |
| Backend framework | FastAPI on Python 3.12 | Matches cv, job2cool, noted; async; SSE-native via `StreamingResponse`. |
| Backend serving | Replace `serve.py` with a FastAPI app that serves static frontend AND mounts `/api/` and `/mcp/` | Single-process simplicity; no Caddy needed in dev; one port. |
| LLM provider | **agent_server** (`http://agent_server:7701`) via OpenAI-compatible `/v1/chat/completions`, exactly as cv, job2cool, and noted use it. NO direct cloud calls. | Matches every reference project in the user's stack; the local Gemma-4 model is served via agent_server; system prompts and presets are managed admin-side. |
| LLM model | `aigeo` agent (configured on agent_server) routing to the active local model (Gemma-4). Override the agent name via `AIGEO_AGENT_NAME`. | Same pattern as noted's `LLM_AGENT_NAME=noted`. The agent name maps to a preset on agent_server that resolves to Gemma-4. |
| Tool surface | 8 tools (§ 8 below) | Covers every query class in §15. |
| Tool transport | In-process (Python function calls from chat backend) AND exposed via MCP server sidecar | Direct calls for the aigeo panel; MCP for future reuse from claude-code, whatsapp_agent, noted. |
| MCP transport | HTTP Streamable at `/mcp/` (same as noted) | Network-reachable; works from JS clients; not stdio-only. |
| Data access | Tools read files directly from `data/ai_agendas/` | No DB; 101 files; trivially indexable in process memory at startup. |
| Authentication | None for v1 (single-user local dev) | Deferred; add Caddy and oauth2-proxy later if exposing publicly. |
| Port | 3388 (same as current aigeo) | Same single-port pattern; FastAPI replaces serve.py. |

## 5. Folder layout

After implementation, the aigeo project tree:

```
~/env/assets/aigeo/
├── ARCHITECTURE.md                        (this doc)
├── serve.py                               (legacy; deleted on cutover)
├── serve.sh                               (updated to launch FastAPI)
├── backend/                               NEW
│   ├── main.py                            FastAPI app: static + /api/ + /mcp/ mount
│   ├── chat.py                            /api/chat SSE endpoint, conversation loop
│   ├── llm.py                             Anthropic streaming client wrapper
│   ├── tools.py                           8 tool implementations (pure Python functions)
│   ├── tool_schemas.py                    JSON Schema for each tool (used by both Anthropic tool-use and MCP)
│   ├── data_loader.py                     Loads ai_agendas/ into memory at startup; in-process cache
│   ├── system_prompt.md                   Assistant persona, citation rules, scope
│   ├── mcp_server.py                      MCP server exposing the same 8 tools at /mcp/
│   ├── requirements.txt                   fastapi, uvicorn, anthropic, mcp, pydantic
│   └── tests/
│       ├── test_tools.py                  Unit tests per tool
│       ├── test_chat.py                   Mocked-LLM chat round-trip
│       └── test_mcp.py                    MCP listTools and callTool round-trip
├── frontend/
│   ├── index.html                         Extend with <script type="module" src="js/chat.js">
│   ├── css/
│   │   ├── style.css                      Existing
│   │   └── chat.css                       NEW: chat-panel styles
│   ├── js/
│   │   ├── app.js                         Extend with chat-to-map binding hook
│   │   ├── chat.js                        NEW: floating panel, message render loop
│   │   ├── chat-stream.js                 NEW: SSE consumer
│   │   └── chat-map-bridge.js             NEW: LLM tool-call -> map state mutations
│   └── vendor/jspanel/                    Existing
└── data/
    ├── worldcountrydata/                  Existing (World Bank indicators)
    └── ai_agendas/                        Existing (ANIA dataset, 101 files)
```

## 6. Backend service

Single FastAPI app at `backend/main.py`. Serves static frontend at `/`, JSON data at `/data/*`, MCP at `/mcp/`, and chat at `/api/chat`.

**Endpoints:**

| Method | Path | Purpose | Streaming |
|---|---|---|---|
| GET | `/` | Static `frontend/index.html` | no |
| GET | `/{path:path}` | Static file from `frontend/` (CSS, JS, geo, fonts, vendor) | no |
| GET | `/data/{path:path}` | Static file from `data/` (the existing aigeo data) | no |
| GET | `/api/health` | `{"ok": true, "model": "...", "tools": 8}` | no |
| POST | `/api/chat` | Body: `{messages: [...]}`. Returns SSE event stream: tokens, tool-call markers, tool-result markers, end-marker. | yes (SSE) |
| GET, POST | `/mcp/*` | MCP HTTP Streamable transport (via `mcp` SDK) | yes (SSE per JSON-RPC) |

**Chat request body:**

```json
{
  "messages": [
    {"role": "user", "content": "Compare Brazil and France on social cohesion."},
    {"role": "assistant", "content": "..."},
    {"role": "user", "content": "And what about Portugal?"}
  ],
  "model": "claude-sonnet-4-6",
  "stream": true
}
```

**Chat SSE event types** (each line `data: {json}\n\n`):

| `type` field | Payload | Frontend behaviour |
|---|---|---|
| `delta` | `{text: "..."}` | Append to current assistant bubble. |
| `tool_call_start` | `{tool: "compare_countries", input: {...}, call_id: "..."}` | Render a tool-call badge in the bubble; optionally side-effect the map (chat-map-bridge). |
| `tool_call_result` | `{call_id: "...", ok: true, content_preview: "..."}` | Mark the tool badge as resolved. |
| `done` | `{stop_reason: "end_turn", input_tokens: ..., output_tokens: ...}` | Close the bubble; show token-usage line at end of conversation. |
| `error` | `{message: "..."}` | Render error in the bubble; reset stream state. |

**Conversation loop (in `chat.py`):**

```
async def chat(messages):
    while True:
        # Stream from Anthropic with the 8 tool definitions
        response = anthropic.messages.stream(
            model=model, system=SYSTEM_PROMPT, messages=messages,
            tools=TOOL_SCHEMAS, max_tokens=4096)
        async for event in response:
            if event is text_delta: yield delta(text)
            if event is tool_use_start: yield tool_call_start
            if event is tool_use_done:
                result = await TOOLS[name](input)        # in-process call
                yield tool_call_result
                messages.append(assistant_message_with_tool_use)
                messages.append(user_message_with_tool_result)
        if stop_reason == "tool_use": continue          # loop again with tool result
        if stop_reason == "end_turn": yield done; break
```

This is the standard Anthropic agentic loop. No multi-model orchestration. Tool calls happen in-process; no HTTP overhead for the aigeo panel use case.

## 7. MCP server (sidecar at `/mcp/`)

The same 8 tools exposed via the MCP protocol so external clients (claude-code, whatsapp_agent, future LLM frontends, manual `curl` for debugging) can call them. Mounts into the same FastAPI app at `/mcp/`.

Pattern from `~/env/assets/noted/backend/app/mcp/server.py` and `mount.py`:

```python
# backend/mcp_server.py
from mcp.server import Server
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager

server = Server("aigeo-ania")
@server.list_tools()
async def list_tools(): return [Tool(name=k, description=v.description, inputSchema=v.schema) for k, v in TOOLS.items()]
@server.call_tool()
async def call_tool(name, args): result = await TOOLS[name](args); return [TextContent(type="text", text=result)]

# backend/main.py
manager = StreamableHTTPSessionManager(server, stateless=True)
app.mount("/mcp", manager)
```

**Registration for external clients.** External MCP clients register the aigeo server by adding to their `mcp_servers.json`:

```json
{
  "name": "aigeo-ania",
  "base": "http://localhost:3388/mcp/",
  "transport": "http-streamable"
}
```

## 8. Tool surface (the 8 tools)

Each tool is a pure Python function in `backend/tools.py` with input validated by Pydantic and output as a string (Markdown for human-readable; JSON-as-string for machine queries). All tools read from the in-memory cache populated by `data_loader.py` at startup.

| # | Tool name | Input | Output | Reads |
|---|---|---|---|---|
| 1 | `list_countries` | (none) | JSON array of `{iso3, country, region, chosen_eight, is_focal_subject, document_type, document_maturity}` | `dataset/countries.csv` |
| 2 | `list_indicators` | optional `aspect: "jobs"\|"democracy"\|"cohesion"\|"ethics_hd"` | JSON array of `{slug, label, aspect, type, scale_max}` | `index.json` |
| 3 | `get_country_profile` | `iso3: str` | Markdown profile | `profiles/<iso3>.md` |
| 4 | `get_indicator_explainer` | `slug: str` | Markdown explainer with country ranking | `indicators/<slug>.md` |
| 5 | `get_country_source_summary` | `iso3: str` | Markdown rich narrative | `country_summaries/<iso3>.md` |
| 6 | `compare_countries` | `iso3_a: str`, `iso3_b: str` | Composite-table side-by-side as Markdown, with both profiles concatenated | two `profiles/<iso3>.md` |
| 7 | `query_scores` | `filter: {column: predicate}` where predicate is `"==N"`, `">=N"`, `"<=N"`, `"in [...]"` | JSON array of matching country rows | `countries.csv` |
| 8 | `get_rubric_section` | `section: "all"\|"§5.1"\|"§5.2"\|"§5.3"\|"§5.4"\|"§6"\|"§7"\|"§8"` | Markdown rubric excerpt | `dataset/rubric.md` |

Plus three optional convenience tools (low priority, add after MVP):

- `get_v2_report_section(section_id)`: read a section from `report/pt_ai_agenda_report.md`
- `get_comparator_matrix_cell(row, col)`: pull a specific cell from `comparator/comparator_matrix.md`
- `focus_country_on_map(iso3, indicator_slug?)`: side-effect that emits a map-action event the frontend listens for (this is how chat updates the map; see §10)

Full JSON Schemas live in `backend/tool_schemas.py` and Appendix B at the end of this doc.

## 9. Frontend chat panel

Single new module `frontend/js/chat.js` plus `chat-stream.js` (SSE consumer) plus `chat-map-bridge.js` (tool-call to map-state binding). Styles in `chat.css`. No build step; loaded as ES modules from `index.html`.

**Panel mechanics** (jsPanel, matching the existing aigeo settings panel):

```js
state.chatPanel = jsPanel.create({
  headerTitle: "Assistant",
  theme: "#3182bd",
  borderRadius: "8px",
  panelSize: { width: 380, height: 560 },
  position: "right-bottom -16 -16",
  headerControls: "closeonly",
  content: `<div class="chat-root">
    <div class="chat-messages" id="chat-messages"></div>
    <form class="chat-input-form">
      <textarea class="chat-input" placeholder="Ask about a country, indicator, or comparison."></textarea>
      <button type="submit">Send</button>
    </form>
  </div>`,
});
```

Launcher button in the topbar (next to the existing gear and theme toggle) opens or closes the panel. State persisted in `localStorage` like the existing legend visibility.

**Message rendering.** Each message is a `<div class="chat-message">` with a role-tagged bubble. The user bubble is right-aligned; assistant bubble is left-aligned. Markdown is rendered with `marked.js` (same lib noted-rag uses). Code is rendered with the existing aigeo monospace stack.

**Streaming.** `chat-stream.js` posts to `/api/chat` with the current message history, then reads the response body as a stream of SSE events. Each `delta` event appends text to the current assistant bubble; each `tool_call_start` renders a small badge inline; each `tool_call_result` resolves the badge.

**Tool-call rendering.** A tool call shows as a collapsible badge: `[get_country_profile: BRA]` clickable. Click expands to show the tool result preview. This is for transparency: the user can see what the LLM looked up.

**Chat-to-map binding.** `chat-map-bridge.js` listens for tool-call events on a custom event bus and triggers map actions:

| Tool call | Map side-effect |
|---|---|
| `get_country_profile(iso3)` | Select the country on the map (calls existing `toggleCountry(cca3)` in `app.js`). |
| `get_indicator_explainer(slug)` | Switch the choropleth layer to the indicator (calls existing `loadIndicator(name)`). |
| `compare_countries(a, b)` | Select country A, then country B with a second highlight class; map zooms to fit both. |
| `query_scores(filter)` | Render the matching countries with a highlight ring on the current layer. |
| `focus_country_on_map(iso3, slug?)` | Explicit form for the LLM to request a focus action. |

The bridge is one file, ~100 lines of vanilla JS. It registers handlers on the `chat` event bus that `chat-stream.js` emits to.

## 10. System prompt (Assistant persona)

Lives at `backend/system_prompt.md`. Loaded once at backend startup; the chat endpoint includes it as the Anthropic `system` parameter. Skeleton:

```markdown
You are the aigeo Assistant. You help users explore the ANIA Assessment Report v2 dataset (national AI strategies across 23 countries scored on four aspects: AI and Jobs, AI and Democracy, AI and Social Cohesion, AI and Ethics and Human Development).

## Scope

- You answer questions about the 23 countries in the dataset and the 24 indicators (4 composites and 20 sub-indicators) defined in the rubric.
- You can fetch per-country profiles, per-indicator explainers, the rubric, and the rich source summaries. Always cite the file you read.
- For comparison questions, use `compare_countries` first; do not hand-roll comparisons from memory.
- For score-based queries (e.g. "which countries score 2 on cohesion"), use `query_scores`.

## Citation convention

- When you state a score, cite the indicator slug: "Brazil scores 3 on `ania-cohesion-composite`".
- When you summarise a country, cite the source file: "Per `profiles/BRA.md`, Brazil's strategy is anchored on...".
- When you compare, cite both source files and the relevant rubric section: "Per `indicators/ania-cohesion-pillar.md` §Score ladder, the 2-threshold is...".

## Calibration

- Scores are ordinal 0-2 (sub-indicators) or 0-3 (composites). Read them as bands, not as continuous values.
- The four composites overlap on four sub-indicators (see `dataset/rubric.md` §6). Mention the overlap when relevant.
- Public-indicator columns (GDP per capita, HDI, etc.) are placeholder until verified; flag this if asked.
- Australia and New Zealand are paired in the v2 report's chosen-eight convention but scored independently.

## Map interaction

- When the user asks about a country, you may call `get_country_profile(iso3)`. The frontend will also select that country on the map.
- When the user asks about an indicator, you may call `get_indicator_explainer(slug)`. The frontend will switch the map layer to that indicator.
- When comparing two countries, the map will highlight both. You do not need to explicitly request a map action.

## Style

- Be specific. Cite scores, slugs, and rubric thresholds rather than vague claims.
- Be brief. Default to 3-6 sentences plus a short data table if relevant. Expand only when asked.
- Do not invent scores or country data. If the dataset does not contain an answer, say so and offer the closest available perspective.
```

## 11. Data access

`backend/data_loader.py` reads the entire `ai_agendas/` tree into memory at startup:

```python
class DataCache:
    countries: list[dict]              # from countries.csv
    indicators_index: dict             # from index.json
    profiles: dict[iso3, str]          # path -> markdown text
    indicator_explainers: dict[slug, str]
    country_summaries: dict[iso3, str]
    rubric: str
    notes: str
    comparator_matrix: str
    report: str

CACHE = DataCache.load("data/ai_agendas")
```

Total in-memory size: ~3-5 MB. Reload on SIGUSR1 for hot edits during dev (optional).

## 12. Deployment

**Dev (local single-machine).** `./serve.sh` becomes:

```bash
#!/usr/bin/env bash
cd "$(dirname "$0")"
exec uvicorn backend.main:app --host 0.0.0.0 --port 3388 --reload
```

Frontend, data, API, and MCP all on `http://localhost:3388`.

**Env vars:**

| Var | Default | Purpose |
|---|---|---|
| `AGENT_SERVER_URL` | `http://agent_server:7701` | agent_server base URL. |
| `AIGEO_AGENT_NAME` | `aigeo` | agent_server preset name (resolves to the active local Gemma model). |
| `AIGEO_MAX_TOKENS` | `4096` | Per-turn max. |
| `AIGEO_TEMPERATURE` | `0.4` | Sampling temperature. |
| `AIGEO_REQUEST_TIMEOUT` | `240` | httpx timeout in seconds. |

**Prod (deferred).** Add Caddy reverse proxy and oauth2-proxy if exposing publicly; that workstream is out of scope for v1.

## 13. Testing

Three layers:

1. **Unit tests** (`tests/test_tools.py`): each of the 8 tools called with valid and invalid input; expected output asserted; runs in <1 s without the LLM.
2. **MCP round-trip** (`tests/test_mcp.py`): `list_tools` returns 8 entries with the documented schemas; `call_tool` for each tool returns non-empty content.
3. **Chat round-trip with mocked LLM** (`tests/test_chat.py`): Anthropic SDK mocked to return a fixed tool_use response then a fixed end_turn; assert the chat endpoint emits the documented SSE event sequence.

Manual validation: run the dev server, open the chat panel, ask each of the 20 questions in Appendix A, and verify the answer cites the right files and triggers the expected map action.

## 14. Risks and open decisions

| Risk / decision | Mitigation or current resolution |
|---|---|
| Anthropic SDK and tool-use semantics may shift across model versions | Pin SDK version in requirements.txt; test against the chosen model id before promoting model upgrades. |
| Long source summaries (Brazil 56 KB, Australia 44 KB) may blow the per-turn context if the LLM aggressively calls `get_country_source_summary` | Truncate summaries to 12 KB by default; offer a `full=true` parameter. |
| Floating panel covers map content; users may want to dismiss | Persist visibility in localStorage; provide minimise-to-launcher pattern (same as cv-chat). |
| MCP server vs in-process tool calls duplication risk | Single source of truth in `tools.py`; the MCP server is a thin adapter. |
| Streaming through a CDN or proxy may buffer SSE | Set explicit `X-Accel-Buffering: no` header; deploy without intermediate buffering proxies. |
| Public-indicator columns are placeholder; LLM may quote them as canonical | System prompt explicitly flags this; tools that return GDP/HDI append a "placeholder" note. |
| No auth in v1 | Local-only dev for now; do not bind to public IP without Caddy and oauth2-proxy. |

Open decisions left for the implementation session (each has a default that I recommend; the user can override):

1. **Model default.** Recommend `claude-sonnet-4-6`. Override if you want haiku for cost.
2. **Markdown renderer.** Recommend `marked.js` (10 KB, no deps). Alternative: `markdown-it` (heavier, more extensible).
3. **Tool-call transparency.** Recommend showing collapsible tool-call badges by default. Alternative: hide them and only show in dev mode.
4. **Conversation persistence.** Recommend in-memory only for v1 (cleared on reload). Alternative: localStorage per session.
5. **Max conversation turns.** Recommend 20 user turns then warn the user that context is getting large. Alternative: unlimited, let the LLM handle truncation.

## 15. Implementation order

Six phases. Each phase is independently testable and leaves a working artefact.

1. **Phase 1: backend skeleton plus tools** (2 to 3 hours). Build `backend/main.py`, `tools.py`, `tool_schemas.py`, `data_loader.py`. Implement the 8 tools as pure functions. Write `tests/test_tools.py` and pass it. Checkpoint: `pytest backend/tests/test_tools.py` green.

2. **Phase 2: Anthropic client plus chat endpoint** (2 hours). Add `llm.py`, `chat.py`, `system_prompt.md`. Implement the SSE chat endpoint with the Anthropic agentic loop. Write `tests/test_chat.py` with a mocked SDK. Checkpoint: chat endpoint returns a streaming response with `curl --no-buffer POST localhost:3388/api/chat`.

3. **Phase 3: MCP server sidecar** (1 hour). Add `mcp_server.py`. Mount at `/mcp/` in `main.py`. Write `tests/test_mcp.py`. Checkpoint: a Python MCP client lists 8 tools and successfully calls `list_countries`.

4. **Phase 4: frontend chat panel** (2 to 3 hours). Add `chat.js`, `chat-stream.js`, `chat.css`. Add launcher button to `index.html`. Manual test: open the panel, send a question, see streaming reply with citations. Checkpoint: a tool call shows a badge that expands to the result.

5. **Phase 5: chat-to-map binding** (1 hour). Add `chat-map-bridge.js`. Wire tool calls to existing `toggleCountry` and `loadIndicator`. Checkpoint: asking "Tell me about Brazil" selects Brazil on the map and opens the existing country-detail panel.

6. **Phase 6: polish and validation** (2 hours). Run all 20 example questions from Appendix A; fix any wrong citations or missed map actions. Audit the new files for standing-rule cleanliness. Update `serve.sh`. Write a short `backend/README.md` for the team.

Total estimate: ~10 to 12 hours of focused implementation. The phases are independently shippable; if a session ends mid-phase, the previous phase's artefact still works.

---

## Appendix A: 20 example user questions

Moved to [`EXAMPLE_QUESTIONS.md`](EXAMPLE_QUESTIONS.md) in the aigeo project root. That document also serves as the Phase 6 manual-validation checklist. If you add or remove items there, mirror the change in §15 Phase 6 of this architecture document.

---

## Appendix B: Tool JSON Schemas (extract)

The complete schemas live in `backend/tool_schemas.py` after Phase 1. Inputs only shown here; outputs are documented in §8.

```json
{
  "list_countries": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  },
  "list_indicators": {
    "type": "object",
    "properties": {
      "aspect": {
        "type": "string",
        "enum": ["jobs", "democracy", "cohesion", "ethics_hd"]
      }
    },
    "additionalProperties": false
  },
  "get_country_profile": {
    "type": "object",
    "properties": {
      "iso3": {"type": "string", "pattern": "^[A-Z]{3}$"}
    },
    "required": ["iso3"],
    "additionalProperties": false
  },
  "get_indicator_explainer": {
    "type": "object",
    "properties": {
      "slug": {"type": "string", "pattern": "^ania-[a-z0-9-]+$"}
    },
    "required": ["slug"],
    "additionalProperties": false
  },
  "get_country_source_summary": {
    "type": "object",
    "properties": {
      "iso3": {"type": "string", "pattern": "^[A-Z]{3}$"},
      "full": {"type": "boolean", "default": false}
    },
    "required": ["iso3"],
    "additionalProperties": false
  },
  "compare_countries": {
    "type": "object",
    "properties": {
      "iso3_a": {"type": "string", "pattern": "^[A-Z]{3}$"},
      "iso3_b": {"type": "string", "pattern": "^[A-Z]{3}$"}
    },
    "required": ["iso3_a", "iso3_b"],
    "additionalProperties": false
  },
  "query_scores": {
    "type": "object",
    "properties": {
      "filter": {
        "type": "object",
        "additionalProperties": {"type": "string"}
      }
    },
    "required": ["filter"],
    "additionalProperties": false
  },
  "get_rubric_section": {
    "type": "object",
    "properties": {
      "section": {
        "type": "string",
        "enum": ["all", "§1", "§2", "§3", "§4", "§5.1", "§5.2", "§5.3", "§5.4", "§6", "§7", "§8", "§9"]
      }
    },
    "required": ["section"],
    "additionalProperties": false
  }
}
```

---

End of architecture document.
