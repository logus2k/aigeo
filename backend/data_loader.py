"""In-memory loader for the ANIA dataset at data/ai_agendas/.

Reads the whole tree at startup. ~3-5 MB; trivially fits in process memory.
Every tool in tools.py reads from the CACHE instance returned here.
"""

from __future__ import annotations

import csv
import json
import os
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class DataCache:
    """In-memory snapshot of data/ai_agendas/ at startup."""

    root: Path
    countries: list[dict] = field(default_factory=list)        # rows from countries.csv
    by_iso3: dict[str, dict] = field(default_factory=dict)     # iso3 -> row
    indicators_index: list[dict] = field(default_factory=list) # entries from index.json
    by_slug: dict[str, dict] = field(default_factory=dict)     # slug -> index entry
    profiles: dict[str, str] = field(default_factory=dict)     # iso3 -> profile MD
    indicator_md: dict[str, str] = field(default_factory=dict) # slug -> explainer MD
    country_summaries: dict[str, str] = field(default_factory=dict)  # iso3 -> summary MD
    indicator_data: dict[str, dict] = field(default_factory=dict)    # slug -> JSON doc
    rubric: str = ""
    notes: str = ""
    comparator_matrix: str = ""
    report: str = ""

    @classmethod
    def load(cls, root: str | os.PathLike) -> "DataCache":
        root = Path(root)
        if not root.is_dir():
            raise FileNotFoundError(f"Data root does not exist: {root}")

        c = cls(root=root)

        # countries.csv
        csv_path = root / "dataset" / "countries.csv"
        with csv_path.open(encoding="utf-8") as f:
            c.countries = list(csv.DictReader(f))
        c.by_iso3 = {row["iso3"]: row for row in c.countries}

        # index.json (the standalone ai_agendas index, registers the 24 ANIA indicators)
        idx_path = root / "index.json"
        idx_doc = json.loads(idx_path.read_text(encoding="utf-8"))
        c.indicators_index = idx_doc.get("indicators", [])
        c.by_slug = {e["indicator"]: e for e in c.indicators_index}

        # profiles/<iso3>.md
        for p in (root / "profiles").glob("*.md"):
            c.profiles[p.stem] = p.read_text(encoding="utf-8")

        # indicators/<slug>.md
        for p in (root / "indicators").glob("*.md"):
            c.indicator_md[p.stem] = p.read_text(encoding="utf-8")

        # country_summaries/<iso3>.md
        for p in (root / "country_summaries").glob("*.md"):
            c.country_summaries[p.stem] = p.read_text(encoding="utf-8")

        # ania-*.json indicator data files (entries, ranks, formatted strings)
        for p in root.glob("ania-*.json"):
            doc = json.loads(p.read_text(encoding="utf-8"))
            slug = doc.get("indicator") or p.stem
            c.indicator_data[slug] = doc

        # rubric, notes, comparator_matrix, report
        c.rubric = (root / "dataset" / "rubric.md").read_text(encoding="utf-8")
        c.notes = (root / "dataset" / "notes.md").read_text(encoding="utf-8")
        c.comparator_matrix = (root / "comparator" / "comparator_matrix.md").read_text(encoding="utf-8")
        c.report = (root / "report" / "pt_ai_agenda_report.md").read_text(encoding="utf-8")

        return c

    def summary(self) -> dict:
        return {
            "countries": len(self.countries),
            "indicators": len(self.indicators_index),
            "profiles": len(self.profiles),
            "indicator_md": len(self.indicator_md),
            "country_summaries": len(self.country_summaries),
            "indicator_data": len(self.indicator_data),
            "rubric_chars": len(self.rubric),
            "notes_chars": len(self.notes),
            "comparator_matrix_chars": len(self.comparator_matrix),
            "report_chars": len(self.report),
        }


_DEFAULT_ROOT = Path(__file__).resolve().parent.parent / "data" / "ai_agendas"


def get_cache(root: str | os.PathLike | None = None) -> DataCache:
    """Module-level singleton accessor.

    First call loads; subsequent calls return the cached instance unless a
    different root path is passed (used in tests).
    """
    global _CACHE  # noqa: PLW0603
    target = Path(root) if root else _DEFAULT_ROOT
    if "_CACHE" not in globals() or _CACHE.root != target:
        _CACHE = DataCache.load(target)
    return _CACHE
