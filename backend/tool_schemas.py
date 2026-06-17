"""JSON Schemas for the 8 ANIA tools.

The same schemas are consumed in two places:
  - Anthropic tool-use API (passed as the `tools` parameter to messages.stream).
  - MCP server (passed as `inputSchema` for each Tool descriptor).

Keep this file source-of-truth; tools.py imports the names and validates inputs
at the boundary.
"""

from __future__ import annotations

ISO3_PATTERN = "^[A-Z]{3}$"
SLUG_PATTERN = "^ania-[a-z0-9-]+$"

ASPECT_ENUM = ["jobs", "democracy", "cohesion", "ethics_hd"]
RUBRIC_SECTION_ENUM = [
    "all", "1", "2", "3", "4",
    "5.1", "5.2", "5.3", "5.4",
    "6", "7", "8", "9",
]


TOOL_SCHEMAS: dict[str, dict] = {
    "list_countries": {
        "name": "list_countries",
        "description": (
            "List all 23 countries in the ANIA dataset with identity metadata "
            "(iso3, country name, region, chosen_eight flag, focal-subject flag, "
            "document type, document maturity). Use this first when you need to "
            "discover what countries are available."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
    },
    "list_indicators": {
        "name": "list_indicators",
        "description": (
            "List the 24 ANIA indicators (4 composites and 20 sub-indicators). "
            "Optionally filter to one aspect: jobs, democracy, cohesion, or "
            "ethics_hd. Returns slug, label, aspect, type (composite vs sub), and "
            "scale max."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "aspect": {"type": "string", "enum": ASPECT_ENUM},
            },
            "additionalProperties": False,
        },
    },
    "get_country_profile": {
        "name": "get_country_profile",
        "description": (
            "Read the full Markdown profile for one country, including identity "
            "block, four composite scores with verbal anchors, all twenty "
            "sub-indicator scores grouped by aspect, distinctive aspects bullets, "
            "and cross-references. Returns ~6-9 KB of Markdown."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "iso3": {"type": "string", "pattern": ISO3_PATTERN},
            },
            "required": ["iso3"],
            "additionalProperties": False,
        },
    },
    "get_indicator_explainer": {
        "name": "get_indicator_explainer",
        "description": (
            "Read the full Markdown explainer for one indicator, including its "
            "definition from the rubric, score ladder (0-2 for sub-indicators or "
            "0-3 for composites), full country ranking with tied ranks, and the "
            "top-of-rank and bottom-of-rank exemplars. Returns ~3-5 KB of Markdown."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "slug": {"type": "string", "pattern": SLUG_PATTERN},
            },
            "required": ["slug"],
            "additionalProperties": False,
        },
    },
    "get_country_source_summary": {
        "name": "get_country_source_summary",
        "description": (
            "Read the rich narrative source summary for one country: the underlying "
            "research document the scoring traces to. Truncated to 12000 chars by "
            "default. Pass full=true for the entire summary (up to ~56 KB for "
            "Brazil). Use this when the profile alone is not enough."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "iso3": {"type": "string", "pattern": ISO3_PATTERN},
                "full": {"type": "boolean", "default": False},
            },
            "required": ["iso3"],
            "additionalProperties": False,
        },
    },
    "compare_countries": {
        "name": "compare_countries",
        "description": (
            "Compare two countries side-by-side: returns a Markdown composite-table "
            "showing both countries' four composite scores plus the verbal anchors, "
            "followed by both country profiles concatenated. Use this for any "
            "two-country comparison question."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "iso3_a": {"type": "string", "pattern": ISO3_PATTERN},
                "iso3_b": {"type": "string", "pattern": ISO3_PATTERN},
            },
            "required": ["iso3_a", "iso3_b"],
            "additionalProperties": False,
        },
    },
    "query_scores": {
        "name": "query_scores",
        "description": (
            "Filter countries by score predicates. The filter is a dict mapping a "
            "score column (e.g. 'cohesion_composite', 'eth_sovereign_llm') to a "
            "predicate string. Supported predicates: '==N', '!=N', '>=N', '<=N', "
            "'>N', '<N', or 'in [N1,N2,...]'. Multiple columns AND together. "
            "Returns a JSON array of matching rows with iso3, country, and the "
            "queried scores."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "filter": {
                    "type": "object",
                    "additionalProperties": {"type": "string"},
                    "minProperties": 1,
                },
            },
            "required": ["filter"],
            "additionalProperties": False,
        },
    },
    "get_rubric_section": {
        "name": "get_rubric_section",
        "description": (
            "Read one section of the scoring rubric. Useful for explaining how a "
            "score is defined or how composites are computed. Section names match "
            "the rubric headers (e.g. '5.3' for the Cohesion aspect, '6' for the "
            "overlapping-sub-indicators section, '7' for the composite formula). "
            "Pass 'all' for the entire rubric."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "section": {"type": "string", "enum": RUBRIC_SECTION_ENUM},
            },
            "required": ["section"],
            "additionalProperties": False,
        },
    },
    "focus_country_on_map": {
        "name": "focus_country_on_map",
        "description": (
            "Select and highlight a country on the world map. Works for ANY "
            "country in the world (any valid ISO3 code), not just the 23 "
            "ANIA-scored ones. Use this whenever the conversation refers to a "
            "country, even if no ANIA data exists for it. Returns a short "
            "confirmation; the actual map mutation happens client-side when the "
            "tool-call event reaches the frontend bridge. Do NOT call "
            "get_country_profile or compare_countries for non-ANIA countries; "
            "this tool is the only ANIA-free country action available."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "iso3": {"type": "string", "pattern": ISO3_PATTERN},
                "reason": {
                    "type": "string",
                    "description": "Optional one-line note for the human-readable confirmation.",
                },
            },
            "required": ["iso3"],
            "additionalProperties": False,
        },
    },
}


def openai_tools() -> list[dict]:
    """OpenAI-compatible `tools` parameter shape (used by agent_server)."""
    return [
        {
            "type": "function",
            "function": {
                "name": s["name"],
                "description": s["description"],
                "parameters": s["input_schema"],
            },
        }
        for s in TOOL_SCHEMAS.values()
    ]


def mcp_tools_descriptors() -> list[dict]:
    """MCP listTools shape (uses inputSchema field name)."""
    return [
        {
            "name": s["name"],
            "description": s["description"],
            "inputSchema": s["input_schema"],
        }
        for s in TOOL_SCHEMAS.values()
    ]
