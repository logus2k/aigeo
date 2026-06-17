"""Unit tests for the 8 ANIA tools. Run with: pytest backend/tests/test_tools.py"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

# Allow running pytest from any cwd.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.data_loader import get_cache  # noqa: E402
from backend import tools  # noqa: E402


@pytest.fixture(scope="module")
def cache():
    return get_cache()


# ---------------------------------------------------------------------------
# Tool 1: list_countries
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_countries_returns_23_entries(cache):
    out = await tools.list_countries(cache=cache)
    data = json.loads(out)
    assert len(data) == 23
    iso3s = {entry["iso3"] for entry in data}
    assert {"PRT", "BRA", "USA", "CHN", "IND", "NZL", "ZAF"}.issubset(iso3s)


@pytest.mark.asyncio
async def test_list_countries_focal_subject_only_portugal(cache):
    out = await tools.list_countries(cache=cache)
    data = json.loads(out)
    focal = [e for e in data if e["is_focal_subject"]]
    assert len(focal) == 1
    assert focal[0]["iso3"] == "PRT"


@pytest.mark.asyncio
async def test_list_countries_chosen_eight_count_is_10(cache):
    # 8 conceptual comparators with AU and NZ both flagged, plus Portugal as focal = 10
    out = await tools.list_countries(cache=cache)
    data = json.loads(out)
    chosen = [e for e in data if e["chosen_eight"]]
    assert len(chosen) == 10


# ---------------------------------------------------------------------------
# Tool 2: list_indicators
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_indicators_returns_24(cache):
    out = await tools.list_indicators(cache=cache)
    data = json.loads(out)
    assert len(data) == 24
    composites = [d for d in data if d["type"] == "composite"]
    subs = [d for d in data if d["type"] == "sub"]
    assert len(composites) == 4
    assert len(subs) == 20




@pytest.mark.asyncio
async def test_list_indicators_filter_by_aspect(cache):
    for aspect, expected in [("jobs", 6), ("democracy", 6), ("cohesion", 6), ("ethics_hd", 6)]:
        out = await tools.list_indicators(aspect=aspect, cache=cache)
        data = json.loads(out)
        assert len(data) == expected, f"{aspect}: got {len(data)}"
        for d in data:
            assert d["aspect"] == aspect


# ---------------------------------------------------------------------------
# Tool 3: get_country_profile
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_country_profile_portugal(cache):
    md = await tools.get_country_profile(iso3="PRT", cache=cache)
    assert "Portugal" in md
    assert "PRT" in md
    assert "Composite scores" in md
    assert "AI and Social Cohesion" in md


@pytest.mark.asyncio
async def test_get_country_profile_unknown_raises(cache):
    with pytest.raises(ValueError, match="Unknown iso3"):
        await tools.get_country_profile(iso3="XYZ", cache=cache)


# ---------------------------------------------------------------------------
# Tool 4: get_indicator_explainer
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_indicator_explainer_cohesion_composite(cache):
    md = await tools.get_indicator_explainer(slug="ania-cohesion-composite", cache=cache)
    assert "Cohesion" in md or "cohesion" in md
    assert "Brazil" in md  # Brazil is rank 1 on cohesion
    assert "Country ranking" in md


@pytest.mark.asyncio
async def test_get_indicator_explainer_unknown_raises(cache):
    with pytest.raises(ValueError, match="Unknown indicator slug"):
        await tools.get_indicator_explainer(slug="ania-nonexistent", cache=cache)


# ---------------------------------------------------------------------------
# Tool 5: get_country_source_summary
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_country_source_summary_truncated_by_default(cache):
    md = await tools.get_country_source_summary(iso3="BRA", cache=cache)
    # Brazil summary is 46KB; truncated to 12000 chars + notice.
    assert len(md) < 13000
    assert "Truncated" in md


@pytest.mark.asyncio
async def test_get_country_source_summary_full(cache):
    md = await tools.get_country_source_summary(iso3="BRA", full=True, cache=cache)
    assert len(md) > 30000  # Brazil is ~46 KB; assert >30 KB to be safe


@pytest.mark.asyncio
async def test_get_country_source_summary_short_not_truncated(cache):
    # Argentina summary is ~8KB; should not be truncated.
    md = await tools.get_country_source_summary(iso3="ARG", cache=cache)
    assert "Truncated" not in md


# ---------------------------------------------------------------------------
# Tool 6: compare_countries
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_compare_countries_brazil_france(cache):
    md = await tools.compare_countries(iso3_a="BRA", iso3_b="FRA", cache=cache)
    assert "Brazil" in md
    assert "France" in md
    assert "Composite scores side-by-side" in md
    # Brazil cohesion = 3; France cohesion = 2
    assert "**3**" in md
    assert "**2**" in md


@pytest.mark.asyncio
async def test_compare_countries_unknown_raises(cache):
    with pytest.raises(ValueError):
        await tools.compare_countries(iso3_a="XYZ", iso3_b="BRA", cache=cache)


# ---------------------------------------------------------------------------
# Tool 7: query_scores
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_query_scores_cohesion_composite_eq_3(cache):
    out = await tools.query_scores(filter={"cohesion_composite": "==3"}, cache=cache)
    data = json.loads(out)
    iso3s = {m["iso3"] for m in data["matches"]}
    assert iso3s == {"BRA", "IND"}


@pytest.mark.asyncio
async def test_query_scores_multi_predicate_and(cache):
    # Countries that are both cohesion-3 and have sovereign LLM operational
    out = await tools.query_scores(
        filter={"cohesion_composite": ">=2", "eth_sovereign_llm": "==2"},
        cache=cache,
    )
    data = json.loads(out)
    assert data["count"] >= 1


@pytest.mark.asyncio
async def test_query_scores_in_predicate(cache):
    out = await tools.query_scores(filter={"jobs_composite": "in [2,3]"}, cache=cache)
    data = json.loads(out)
    assert data["count"] > 0
    for m in data["matches"]:
        assert m["jobs_composite"] in (2, 3)


@pytest.mark.asyncio
async def test_query_scores_invalid_column_raises(cache):
    with pytest.raises(ValueError, match="Unknown column"):
        await tools.query_scores(filter={"not_a_column": "==1"}, cache=cache)


@pytest.mark.asyncio
async def test_query_scores_invalid_predicate_raises(cache):
    with pytest.raises(ValueError, match="Invalid predicate"):
        await tools.query_scores(filter={"cohesion_composite": "garbage"}, cache=cache)


# ---------------------------------------------------------------------------
# Tool 8: get_rubric_section
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_rubric_section_53_cohesion(cache):
    md = await tools.get_rubric_section(section="5.3", cache=cache)
    assert "Cohesion" in md or "cohesion" in md
    # Should be a focused excerpt (not the whole rubric)
    assert len(md) < len(cache.rubric)


@pytest.mark.asyncio
async def test_get_rubric_section_6_overlap(cache):
    md = await tools.get_rubric_section(section="6", cache=cache)
    assert "verlap" in md  # "Overlap" or "overlap"


@pytest.mark.asyncio
async def test_get_rubric_section_7_composite_formula(cache):
    md = await tools.get_rubric_section(section="7", cache=cache)
    # Composite formula section discusses sums and bands.
    assert "ompos" in md  # "Composite" or "composite"


@pytest.mark.asyncio
async def test_get_rubric_section_all_returns_full(cache):
    md = await tools.get_rubric_section(section="all", cache=cache)
    assert md == cache.rubric


# ---------------------------------------------------------------------------
# Dispatch table sanity
# ---------------------------------------------------------------------------

def test_dispatch_table_has_9_tools():
    assert len(tools.TOOLS) == 9
    assert set(tools.TOOLS) == {
        "list_countries", "list_indicators", "get_country_profile",
        "get_indicator_explainer", "get_country_source_summary",
        "compare_countries", "query_scores", "get_rubric_section",
        "focus_country_on_map",
    }


@pytest.mark.asyncio
async def test_focus_country_on_map_inside_corpus(cache):
    out = await tools.focus_country_on_map(iso3="BRA", cache=cache)
    data = json.loads(out)
    assert data["iso3"] == "BRA"
    assert data["in_ania_corpus"] is True
    assert data["country_name"] == "Brazil"


@pytest.mark.asyncio
async def test_focus_country_on_map_outside_corpus(cache):
    out = await tools.focus_country_on_map(iso3="PAK", cache=cache)
    data = json.loads(out)
    assert data["iso3"] == "PAK"
    assert data["in_ania_corpus"] is False
    assert data["country_name"] is None
    assert "NOT available" in data["note"]


@pytest.mark.asyncio
async def test_focus_country_on_map_rejects_bad_iso3(cache):
    with pytest.raises(ValueError):
        await tools.focus_country_on_map(iso3="P", cache=cache)
    with pytest.raises(ValueError):
        await tools.focus_country_on_map(iso3="123", cache=cache)


@pytest.mark.asyncio
async def test_call_tool_via_dispatch(cache):
    out = await tools.call_tool("list_countries", {}, cache=cache)
    data = json.loads(out)
    assert len(data) == 23
