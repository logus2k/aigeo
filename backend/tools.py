"""The 8 ANIA tools (in-process implementations).

Each tool is a pure function taking validated kwargs and returning a string
(Markdown for human-readable; JSON-as-string for machine queries).

The dispatch dict TOOLS at the bottom maps tool name -> callable; the chat loop
and the MCP server both go through this dict.
"""

from __future__ import annotations

import json
import re
from typing import Any

from .data_loader import DataCache, get_cache


SUMMARY_TRUNCATION_CHARS = 12000  # default truncation for get_country_source_summary


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _aspect_to_columns() -> dict[str, list[str]]:
    """Map aspect name -> list of CSV columns belonging to that aspect."""
    return {
        "jobs": [
            "jobs_workforce_training_quantified",
            "jobs_specialist_pipeline",
            "jobs_union_or_social_dialogue",
            "jobs_distributional_monitoring",
            "jobs_productivity_target_quantified",
            "jobs_composite",
        ],
        "democracy": [
            "dem_civic_participation",
            "dem_multi_watchdog_oversight",
            "dem_civil_society_in_ethics_body",
            "dem_transparency_register",
            "dem_election_or_disinfo_instruments",
            "democracy_composite",
        ],
        "cohesion": [
            "coh_structural_cohesion_pillar",
            "coh_algorithmic_fairness_toolkit",
            "coh_linguistic_substrate",
            "coh_territorial_distribution",
            "coh_digital_inclusion_cohorts",
            "cohesion_composite",
        ],
        "ethics_hd": [
            "eth_sovereign_llm",
            "eth_open_source_commitment",
            "eth_ai_act_or_equivalent",
            "eth_ethics_body_operational",
            "eth_human_development_alignment",
            "ethics_hd_composite",
        ],
    }


def _slug_to_csv_column(slug: str) -> str | None:
    """Map an indicator slug (ania-jobs-composite) to the CSV column it scores."""
    mapping = {
        "ania-jobs-composite": "jobs_composite",
        "ania-jobs-workforce-training": "jobs_workforce_training_quantified",
        "ania-jobs-specialist-pipeline": "jobs_specialist_pipeline",
        "ania-jobs-union-dialogue": "jobs_union_or_social_dialogue",
        "ania-jobs-distributional-monitoring": "jobs_distributional_monitoring",
        "ania-jobs-productivity-target": "jobs_productivity_target_quantified",
        "ania-democracy-composite": "democracy_composite",
        "ania-democracy-civic-participation": "dem_civic_participation",
        "ania-democracy-multi-watchdog": "dem_multi_watchdog_oversight",
        "ania-democracy-civil-society-ethics": "dem_civil_society_in_ethics_body",
        "ania-democracy-transparency-register": "dem_transparency_register",
        "ania-democracy-election-disinfo": "dem_election_or_disinfo_instruments",
        "ania-cohesion-composite": "cohesion_composite",
        "ania-cohesion-pillar": "coh_structural_cohesion_pillar",
        "ania-cohesion-fairness-toolkit": "coh_algorithmic_fairness_toolkit",
        "ania-cohesion-linguistic-substrate": "coh_linguistic_substrate",
        "ania-cohesion-territorial": "coh_territorial_distribution",
        "ania-cohesion-inclusion-cohorts": "coh_digital_inclusion_cohorts",
        "ania-ethics-hd-composite": "ethics_hd_composite",
        "ania-ethics-hd-sovereign-llm": "eth_sovereign_llm",
        "ania-ethics-hd-open-source": "eth_open_source_commitment",
        "ania-ethics-hd-ai-act": "eth_ai_act_or_equivalent",
        "ania-ethics-hd-ethics-body": "eth_ethics_body_operational",
        "ania-ethics-hd-human-development": "eth_human_development_alignment",
    }
    return mapping.get(slug)


def _composite_aspect_for_slug(slug: str) -> str:
    if slug.startswith("ania-jobs"): return "jobs"
    if slug.startswith("ania-democracy"): return "democracy"
    if slug.startswith("ania-cohesion"): return "cohesion"
    if slug.startswith("ania-ethics-hd"): return "ethics_hd"
    return ""


def _is_composite(slug: str) -> bool:
    return slug.endswith("-composite")


# ---------------------------------------------------------------------------
# Tool 1: list_countries
# ---------------------------------------------------------------------------

async def list_countries(cache: DataCache | None = None) -> str:
    cache = cache or get_cache()
    out = []
    for row in cache.countries:
        out.append({
            "iso3": row["iso3"],
            "country": row["country"],
            "region": row["region"],
            "chosen_eight": row.get("chosen_eight") == "true",
            "is_focal_subject": row.get("is_focal_subject") == "true",
            "document_type": row.get("document_type", ""),
            "document_maturity": row.get("document_maturity", ""),
        })
    return json.dumps(out, ensure_ascii=False, indent=2)


# ---------------------------------------------------------------------------
# Tool 2: list_indicators
# ---------------------------------------------------------------------------

async def list_indicators(aspect: str | None = None, cache: DataCache | None = None) -> str:
    cache = cache or get_cache()
    out = []
    for entry in cache.indicators_index:
        slug = entry.get("indicator", "")
        if not slug.startswith("ania-"):
            continue
        slug_aspect = _composite_aspect_for_slug(slug)
        if aspect and slug_aspect != aspect:
            continue
        scale_max = entry.get("statistics", {}).get("scale_max")
        out.append({
            "slug": slug,
            "label": entry.get("label", ""),
            "aspect": slug_aspect,
            "type": "composite" if _is_composite(slug) else "sub",
            "scale_max": scale_max if scale_max is not None else (3 if _is_composite(slug) else 2),
        })
    return json.dumps(out, ensure_ascii=False, indent=2)


# ---------------------------------------------------------------------------
# Tool 3: get_country_profile
# ---------------------------------------------------------------------------

async def get_country_profile(iso3: str, cache: DataCache | None = None) -> str:
    cache = cache or get_cache()
    md = cache.profiles.get(iso3)
    if md is None:
        raise ValueError(f"Unknown iso3: {iso3}. Use list_countries to see available codes.")
    return md


# ---------------------------------------------------------------------------
# Tool 4: get_indicator_explainer
# ---------------------------------------------------------------------------

async def get_indicator_explainer(slug: str, cache: DataCache | None = None) -> str:
    cache = cache or get_cache()
    md = cache.indicator_md.get(slug)
    if md is None:
        raise ValueError(f"Unknown indicator slug: {slug}. Use list_indicators to see available slugs.")
    return md


# ---------------------------------------------------------------------------
# Tool 5: get_country_source_summary
# ---------------------------------------------------------------------------

async def get_country_source_summary(iso3: str, full: bool = False, cache: DataCache | None = None) -> str:
    cache = cache or get_cache()
    md = cache.country_summaries.get(iso3)
    if md is None:
        raise ValueError(f"Unknown iso3: {iso3}. Use list_countries to see available codes.")
    if full or len(md) <= SUMMARY_TRUNCATION_CHARS:
        return md
    truncated = md[:SUMMARY_TRUNCATION_CHARS]
    notice = (
        f"\n\n---\n*Truncated at {SUMMARY_TRUNCATION_CHARS} chars (full length {len(md)}). "
        "Call again with full=true for the entire summary.*\n"
    )
    return truncated + notice


# ---------------------------------------------------------------------------
# Tool 6: compare_countries
# ---------------------------------------------------------------------------

_COMPOSITES = ["jobs_composite", "democracy_composite", "cohesion_composite", "ethics_hd_composite"]
_COMPOSITE_LABELS = {
    "jobs_composite": "AI and Jobs",
    "democracy_composite": "AI and Democracy",
    "cohesion_composite": "AI and Social Cohesion",
    "ethics_hd_composite": "AI, Ethics and Human Development",
}
_COMPOSITE_ANCHORS = {
    0: "absent or principle-level",
    1: "limited operational presence",
    2: "strong operational presence",
    3: "central operational concern",
}


async def compare_countries(iso3_a: str, iso3_b: str, cache: DataCache | None = None) -> str:
    cache = cache or get_cache()
    a = cache.by_iso3.get(iso3_a)
    b = cache.by_iso3.get(iso3_b)
    if a is None:
        raise ValueError(f"Unknown iso3: {iso3_a}.")
    if b is None:
        raise ValueError(f"Unknown iso3: {iso3_b}.")

    rows = [
        f"# Comparison: {a['country']} ({iso3_a}) and {b['country']} ({iso3_b})",
        "",
        "## Composite scores side-by-side",
        "",
        f"| Aspect | {a['country']} | {b['country']} |",
        "|---|---|---|",
    ]
    for col in _COMPOSITES:
        va = int(a[col])
        vb = int(b[col])
        anchor_a = _COMPOSITE_ANCHORS.get(va, "")
        anchor_b = _COMPOSITE_ANCHORS.get(vb, "")
        rows.append(
            f"| {_COMPOSITE_LABELS[col]} | **{va}** ({anchor_a}) | **{vb}** ({anchor_b}) |"
        )
    rows.append("")
    rows.append("## Full profile: " + a["country"])
    rows.append("")
    rows.append(cache.profiles.get(iso3_a, "(profile not found)"))
    rows.append("")
    rows.append("## Full profile: " + b["country"])
    rows.append("")
    rows.append(cache.profiles.get(iso3_b, "(profile not found)"))
    return "\n".join(rows)


# ---------------------------------------------------------------------------
# Tool 7: query_scores
# ---------------------------------------------------------------------------

_PREDICATE_RE = re.compile(
    r"""^\s*(
        (==|!=|>=|<=|>|<)\s*(-?\d+)
        |
        in\s*\[\s*(-?\d+(?:\s*,\s*-?\d+)*)\s*\]
    )\s*$""",
    re.VERBOSE | re.IGNORECASE,
)


def _eval_predicate(value: int, predicate: str) -> bool:
    m = _PREDICATE_RE.match(predicate)
    if not m:
        raise ValueError(
            f"Invalid predicate: {predicate!r}. "
            "Expected '==N', '!=N', '>=N', '<=N', '>N', '<N', or 'in [N1,N2,...]'."
        )
    if m.group(2):
        op = m.group(2)
        n = int(m.group(3))
        return {
            "==": value == n,
            "!=": value != n,
            ">=": value >= n,
            "<=": value <= n,
            ">": value > n,
            "<": value < n,
        }[op]
    members = [int(x.strip()) for x in m.group(4).split(",")]
    return value in members


async def query_scores(filter: dict[str, str], cache: DataCache | None = None) -> str:
    cache = cache or get_cache()
    if not filter:
        raise ValueError("filter must contain at least one column predicate.")

    # Validate all columns exist before iterating, to fail fast.
    if cache.countries:
        valid_cols = set(cache.countries[0].keys())
        unknown = [c for c in filter if c not in valid_cols]
        if unknown:
            raise ValueError(f"Unknown column(s): {unknown}. Sample columns: cohesion_composite, eth_sovereign_llm, ...")

    matches = []
    for row in cache.countries:
        ok = True
        for col, pred in filter.items():
            try:
                v = int(row[col])
            except (ValueError, KeyError):
                ok = False
                break
            if not _eval_predicate(v, pred):
                ok = False
                break
        if ok:
            entry = {
                "iso3": row["iso3"],
                "country": row["country"],
                "region": row["region"],
            }
            for col in filter:
                entry[col] = int(row[col])
            matches.append(entry)

    return json.dumps(
        {"filter": filter, "count": len(matches), "matches": matches},
        ensure_ascii=False, indent=2,
    )


# ---------------------------------------------------------------------------
# Tool 8: get_rubric_section
# ---------------------------------------------------------------------------

# Rubric §-headers: "## 1. Scope of countries" (top-level) or "### 5.1 Aspect 1: ..." (sub-level).
_RUBRIC_SECTION_RE = re.compile(r"^#{2,3}\s+(\d+(?:\.\d+)?)[\.\s]", re.MULTILINE)


async def get_rubric_section(section: str, cache: DataCache | None = None) -> str:
    cache = cache or get_cache()
    text = cache.rubric
    if section == "all":
        return text

    # Find the requested section header and the next sibling header at the same or higher level.
    matches = list(_RUBRIC_SECTION_RE.finditer(text))
    if not matches:
        return text  # rubric did not parse as expected; return full text rather than empty
    start = None
    end = len(text)
    for i, m in enumerate(matches):
        if m.group(1) == section:
            start = m.start()
            # Stop at the next header at the same depth or shallower.
            our_depth = section.count(".")
            for nm in matches[i + 1:]:
                next_depth = nm.group(1).count(".")
                if next_depth <= our_depth:
                    end = nm.start()
                    break
                # If we are at top level (depth 0), next top-level header is the end.
                if our_depth == 0 and next_depth == 0:
                    end = nm.start()
                    break
            break
    if start is None:
        raise ValueError(f"Unknown rubric section: {section!r}.")
    return text[start:end].strip() + "\n"


# ---------------------------------------------------------------------------
# Dispatch table (used by chat loop and MCP server)
# ---------------------------------------------------------------------------

TOOLS: dict[str, Any] = {
    "list_countries": list_countries,
    "list_indicators": list_indicators,
    "get_country_profile": get_country_profile,
    "get_indicator_explainer": get_indicator_explainer,
    "get_country_source_summary": get_country_source_summary,
    "compare_countries": compare_countries,
    "query_scores": query_scores,
    "get_rubric_section": get_rubric_section,
}


async def call_tool(name: str, args: dict, cache: DataCache | None = None) -> str:
    fn = TOOLS.get(name)
    if fn is None:
        raise ValueError(f"Unknown tool: {name}. Available: {sorted(TOOLS)}.")
    return await fn(**(args or {}), cache=cache)
