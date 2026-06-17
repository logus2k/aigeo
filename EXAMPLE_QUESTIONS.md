# aigeo Assistant: 20 example user questions

This document complements [`ARCHITECTURE.md`](ARCHITECTURE.md). It enumerates twenty representative questions a user is plausibly going to ask the conversational Assistant once integration is complete. Each entry names the tools the LLM is expected to call and the map side-effect it should trigger. The list doubles as the manual-validation checklist for the implementation's Phase 6.

The four categories below (per-country drill-down; indicator-specific; two-country comparison; cross-cutting pattern analysis) span the full surface of the 8-tool API documented in [`ARCHITECTURE.md`](ARCHITECTURE.md) §8 and exercise every chat-to-map binding described in §9.

## Per-country drill-down (5)

1. **"What does Portugal's AI agenda say about social cohesion?"**
   Tools: `get_country_profile("PRT")`, `get_indicator_explainer("ania-cohesion-composite")`.
   Map: focus Portugal; switch layer to `ania-cohesion-composite`.

2. **"Why does Brazil score 3 on cohesion?"**
   Tools: `get_country_profile("BRA")`, `get_indicator_explainer("ania-cohesion-composite")`, optionally `get_country_source_summary("BRA")`.
   Map: focus Brazil; layer cohesion.

3. **"What are the main strengths and weaknesses of Egypt's AI strategy?"**
   Tools: `get_country_source_summary("EGY")`, `get_country_profile("EGY")`.
   Map: focus Egypt.

4. **"How does India's IndiaAI Mission handle digital inclusion?"**
   Tools: `get_country_source_summary("IND")`, `get_indicator_explainer("ania-cohesion-inclusion-cohorts")`.
   Map: focus India; layer inclusion-cohorts.

5. **"What is South Africa's approach to AI hub distribution across the country?"**
   Tools: `get_country_profile("ZAF")`, `get_indicator_explainer("ania-cohesion-territorial")`.
   Map: focus South Africa; layer territorial.

## Indicator-specific (5)

6. **"What does the cohesion composite measure?"**
   Tools: `get_indicator_explainer("ania-cohesion-composite")`, `get_rubric_section("§5.3")`.
   Map: switch layer to cohesion composite (no country focus).

7. **"Which countries score highest on civic participation?"**
   Tools: `query_scores({"dem_civic_participation": "==2"})`, `get_indicator_explainer("ania-democracy-civic-participation")`.
   Map: layer civic-participation; highlight matching countries.

8. **"How is 'algorithmic fairness toolkit' defined and which countries have one operational?"**
   Tools: `get_indicator_explainer("ania-cohesion-fairness-toolkit")`, `query_scores({"coh_algorithmic_fairness_toolkit": "==2"})`.
   Map: layer fairness-toolkit.

9. **"What is the rubric's definition of a sovereign LLM and what is the difference between the cohesion-substrate and ethics-sovereign-llm sub-indicators?"**
   Tools: `get_rubric_section("§6")` (the overlap section), `get_indicator_explainer("ania-cohesion-linguistic-substrate")`, `get_indicator_explainer("ania-ethics-hd-sovereign-llm")`.

10. **"Which countries have a dedicated AI statute?"**
    Tools: `query_scores({"eth_ai_act_or_equivalent": ">=2"})`, `get_indicator_explainer("ania-ethics-hd-ai-act")`.
    Map: layer ai-act.

## Two-country comparison (5)

11. **"How do Brazil and France compare on social cohesion?"**
    Tools: `compare_countries("BRA", "FRA")`, `get_indicator_explainer("ania-cohesion-composite")`.
    Map: select Brazil and France; layer cohesion.

12. **"Which is more advanced on Ethics and Human Development, Japan or Spain?"**
    Tools: `compare_countries("JPN", "ESP")`, `get_indicator_explainer("ania-ethics-hd-composite")`.
    Map: both highlighted; layer ethics-hd.

13. **"Compare Portugal with Australia on the Jobs aspect."**
    Tools: `compare_countries("PRT", "AUS")`, `get_indicator_explainer("ania-jobs-composite")`.
    Map: both highlighted; layer jobs.

14. **"What are the key differences between the US and Chinese AI strategies?"**
    Tools: `compare_countries("USA", "CHN")`, `get_country_source_summary("USA")`, `get_country_source_summary("CHN")`.
    Map: both highlighted; layer default composite.

15. **"How does Portugal compare against the four chosen-eight comparators that score 3 on cohesion?"**
    Tools: `query_scores({"cohesion_composite": "==3"})`, then `compare_countries("PRT", "BRA")` and `compare_countries("PRT", "IND")`.
    Map: highlight all five.

## Cross-cutting / pattern analysis (5)

16. **"Which countries treat cohesion as central rather than derivative?"**
    Tools: `query_scores({"coh_structural_cohesion_pillar": "==2"})`, `get_indicator_explainer("ania-cohesion-pillar")`.
    Map: layer cohesion-pillar; highlight matching.

17. **"What patterns emerge across the four African comparators (Egypt, South Africa, Kenya, Nigeria)?"**
    Tools: `compare_countries` between pairs, plus `get_country_profile` for each of the four.
    Map: highlight all four; default layer.

18. **"Where does Portugal sit relative to the leading comparators on each of the four aspects?"**
    Tools: `get_country_profile("PRT")`, `list_indicators("jobs")`, `list_indicators("democracy")`, `list_indicators("cohesion")`, `list_indicators("ethics_hd")`.
    Map: focus Portugal.

19. **"What would Portugal need to do to lift its cohesion composite from 0 to 2?"**
    Tools: `get_country_profile("PRT")`, `get_indicator_explainer("ania-cohesion-composite")`, then a comparison-style readout against the chosen-eight cohesion exemplars.
    Map: focus Portugal; layer cohesion.

20. **"Are there indicators where countries with very high HDI score low and vice versa?"**
    Tools: `query_scores` on each aspect plus per-country HDI lookup, then a small cross-tab.
    Note: this question reaches the public-indicator-placeholder caveat; the Assistant should disclose that HDI values are not yet verified.
    Map: layer the chosen aspect; highlight outliers.

---

## Notes on the selection

The twenty are spread deliberately across the surface so that Phase 6 validation covers every tool, every aspect, and every chat-to-map binding type. Specifically:

- All eight tools are exercised. `list_countries` is implicit in 18; `list_indicators` is explicit in 18; `query_scores` is exercised in 7, 8, 10, 15, 16, 20; `get_country_profile` and `get_indicator_explainer` are exercised throughout; `get_country_source_summary` in 2, 3, 4, 14; `compare_countries` in 11, 12, 13, 14, 15, 17; `get_rubric_section` in 6 and 9.
- All four aspects are covered (Jobs in 13; Democracy in 7, 14; Cohesion in 1, 2, 4, 5, 6, 8, 11, 15, 16, 19; Ethics and Human Development in 9, 10, 12).
- Every chat-to-map binding type is exercised (focus single country; switch layer; both-country highlight; query-based multi-country highlight).
- One question deliberately stresses the placeholder-public-indicator caveat (question 20) so the Assistant's disclosure behaviour is validated.

If you add or remove items here, mirror the change in [`ARCHITECTURE.md`](ARCHITECTURE.md) §15 Phase 6 (manual validation step).
