# AI National Agendas Dataset: scoring rubric

This document is the rulebook for `countries.csv`. Every ordinal score in the CSV is derived from the per-country source summaries (in `~/env/assets/noted/data/projects/portugal_ai_agenda/` plus the supplementary `final_project/india_and_new_zealand/` folder) and from the named primary documents. Anyone applying this rubric to the same source material should arrive at the same scores.

## 1. Scope of countries (23 rows, Portugal as focal anchor)

Portugal is the focal subject (the country the ANIA Assessment Report v2 audits). The other twenty-two are comparators, of which eight are the chosen-eight set foregrounded in the report.

| ISO3 | Country | Chosen 8 | Region | Source summary location |
|---|---|---|---|---|
| PRT | Portugal | (focal) | Europe | `noted/portugal_summary.md` |
| ARG | Argentina | no | Americas | `noted/argentina_summary.md` |
| AUS | Australia | yes | APAC | `noted/australia_summary.md` |
| BRA | Brazil | yes | Americas | `noted/brazil_summary.md` |
| CHN | China | no | APAC | `noted/china_summary.md` |
| EGY | Egypt | yes | Africa | `noted/egypt_summary.md` |
| FIN | Finland | yes | Europe | `noted/finland_summary.md` |
| FRA | France | yes | Europe | `noted/france_summary.md` |
| DEU | Germany | no | Europe | `noted/germany_summary.md` |
| IND | India | yes | APAC | `final_project/india_and_new_zealand/india_summary.md` |
| ITA | Italy | no | Europe | `noted/italy_summary.md` |
| JPN | Japan | no | APAC | `noted/japan_summary.md` |
| KEN | Kenya | no | Africa | `noted/kenya_summary.md` |
| NGA | Nigeria | no | Africa | `noted/nigeria_summary.md` |
| NZL | New Zealand | yes | APAC | `final_project/india_and_new_zealand/new_zealand_summary.md` |
| QAT | Qatar | no | MENA | `noted/qatar_summary.md` |
| SGP | Singapore | no | APAC | `noted/singapore_summary.md` |
| ZAF | South Africa | yes | Africa | `noted/south_africa_summary.md` |
| ESP | Spain | no | Europe | `noted/spain_summary.md` |
| SWE | Sweden | no | Europe | `noted/sweden_summary.md` |
| ARE | UAE | no | MENA | `noted/uae_summary.md` |
| GBR | United Kingdom | no | Europe | `noted/uk_summary.md` |
| USA | United States | yes | Americas | `noted/usa_summary.md` |

Eight of the twenty-three are flagged as `chosen_eight = true` and match the v2 report's narrative scope (Portugal-focal plus Australia, New Zealand, India, France, Finland, USA, Brazil, South Africa, Egypt; Australia and New Zealand counted as one of the eight comparators per the report's pairing).

## 2. Identity columns (no scoring needed)

| Column | Type | Notes |
|---|---|---|
| `country` | text | Country name in English. |
| `iso3` | text | ISO 3166-1 alpha-3. |
| `region` | categorical | APAC, Europe, Americas, Africa, MENA. |
| `analyzed_in_report` | boolean | True for all 23 rows; reserved for future expansion beyond the analyzed corpus. |
| `chosen_eight` | boolean | True for the focal subject (Portugal) and the eight comparators foregrounded in the v2 report (per table in §1 above). Used by the map for the "main countries in the report" filter (nine rows). |
| `is_focal_subject` | boolean | True only for Portugal. Lets the map style the focal subject distinctly without losing the chosen-nine filter. The "strict comparators only" filter is `chosen_eight = true AND is_focal_subject = false`. |
| `document_type` | categorical | One of: `AI Strategy`, `Digital Strategy`, `Hybrid`. See §3 for the rule. |
| `document_maturity` | categorical | One of: `operational`, `cabinet-approved`, `discussion-draft`, `sectoral-only`, `not-AI-specific`. See §3 for the rule. |
| `primary_document_title` | text | Title and year of the anchoring document. |
| `primary_document_url` | URL | Canonical link to the primary document (government portal preferred over mirror). Where the canonical link is broken or paywalled, the closest stable mirror is used with a note in `source_notes`. |
| `source_notes` | text | One-line caveat per row (broken link, document supersession, multi-document set, etc.). Free text. |

## 3. Document classification rules

`document_type` is the user-requested attribute that lets the map distinguish countries whose primary source is an AI-specific strategy from those whose primary source is a broader digital strategy.

| Value | Definition | Examples |
|---|---|---|
| `AI Strategy` | The primary document is explicitly an AI strategy, AI agenda, AI action plan, or AI act. AI is the document's central subject. | Portugal ANIA 2026, France Stratégie nationale 2024, USA America's AI Action Plan, Brazil PBIA 2024-2028, India IndiaAI Mission, Egypt National AI Strategy 2025-2030, Australia National AI Plan 2025. |
| `Digital Strategy` | The primary document is a broader digital strategy or digital agenda; AI appears as one section among others. | Argentina Digital Agenda 2018, Qatar Digital Agenda 2030. |
| `Hybrid` | The primary anchor is a paired set where one document is AI-specific and another is a broader digital framework, both load-bearing. | Japan (AI Strategy 2022 plus AI Basic Plan 2025); Portugal could arguably qualify (ANIA plus EDN), but for this dataset Portugal is classified `AI Strategy` because ANIA is the document the report assesses. |

`document_maturity` is orthogonal to type and captures how binding the document is.

| Value | Definition |
|---|---|
| `operational` | Adopted and in force; named institutional owner; budget itemised or implementation underway. |
| `cabinet-approved` | Adopted by executive but no parliamentary statute, or operational machinery still being stood up. |
| `discussion-draft` | Published for consultation; not yet adopted (South Africa AI Planning Oct 2023 is the canonical case). |
| `sectoral-only` | Sectoral AI commitments exist but no national-level AI strategy document. |
| `not-AI-specific` | The primary document is a broader digital strategy with an AI section (overlaps `Digital Strategy` in `document_type`). |

These two columns together let the map honestly distinguish "USA has a Cabinet-approved AI strategy" from "Argentina has a 2018 digital agenda with no AI-specific document". Both are scored, but the maturity column tells the truth about the source.

## 4. Public-indicator anchors (no scoring needed)

| Column | Source | Latest available year |
|---|---|---|
| `gdp_per_capita_usd` | World Bank (current US\$, Atlas method) | populate with latest available per country |
| `population_millions` | UN World Population Prospects | latest available |
| `hdi` | UNDP Human Development Report | latest available |
| `gini` | World Bank (most recent year per country) | latest available |
| `ai_readiness_index` | Oxford Insights Government AI Readiness Index | 2024 (latest published) |
| `renewable_electricity_share` | Our World in Data | latest available |

All six are decimal-friendly and can drive any choropleth layer in the map.

## 5. Aspect-block scoring

Each of the four aspects has one composite score (0 to 3) and five ordinal sub-indicators (each 0, 1, or 2). The composite is computed from the sub-indicators (§7).

The four aspects deliberately overlap on three sub-indicators (§6). Those overlapping sub-indicators are scored once per country and contribute to both aspect composites.

### 5.1 Aspect 1: AI and Jobs (`jobs_composite`)

The Jobs aspect measures how the strategy treats AI's labour-market consequences: who gets trained, who gets represented, and whether the distributional effects are tracked.

| Sub-indicator | 0 | 1 | 2 |
|---|---|---|---|
| `jobs_workforce_training_quantified` | No workforce training target. | Cohort named without a numeric size. | Numeric cohort target (e.g. India IndiaAI FutureSkills 860,000 enrolled; South Africa 30% whole-population workforce literacy). |
| `jobs_specialist_pipeline` | No specialist track. | Specialist track named without numbers. | Quantified specialist target (e.g. South Africa 20,000 AI specialists plus 5,000 experts; Egypt 30,000 AI professionals by 2030). |
| `jobs_union_or_social_dialogue` | Not addressed in the strategy. | Consultative reference to unions or social partners. | Institutional representation in governance (France social-dialogue mandate inside Humanism pillar; Finland trade-union representation in the strategic-level roundtable). |
| `jobs_distributional_monitoring` *(overlap with Cohesion §5.3)* | Not addressed. | Distributional language without a monitoring system. | Operational monitoring or binding target across gender, age, disability, or migrant origin (Brazil 50% women-researcher binding target; India Jan Dhan gender mainstreaming). |
| `jobs_productivity_target_quantified` | No headline productivity or GDP-add figure. | Qualitative productivity ambition. | Quantified figure (Australia A\$116 B GDP add and 4.3 pp productivity by 2030; Portugal €18-22 B/yr GDP add). |

### 5.2 Aspect 2: AI and Democracy (`democracy_composite`)

The Democracy aspect measures the strategy's treatment of public-sector AI legitimacy: who participates, who oversees, who can scrutinise.

| Sub-indicator | 0 | 1 | 2 |
|---|---|---|---|
| `dem_civic_participation` | No civic-participation provision. | Consultation announced. | Institutionalised participation in the design of the strategy (Brazil's 117-institution governance; France's AI Cafés citizen-deliberation spaces; participatory drafting methodology). |
| `dem_multi_watchdog_oversight` | No multi-watchdog mechanism. | Watchdog body announced. | Operational with cadence (Australia's AI Review Committee meeting every six weeks, aggregating Information Commissioner, Privacy Commissioner, Ombudsman, and rotating sectoral regulators). |
| `dem_civil_society_in_ethics_body` *(overlap with Ethics §5.4)* | Civil society not represented. | Mention without seats. | Mandated representation in an operational ethics body. |
| `dem_transparency_register` *(overlap with Cohesion §5.3 algorithmic fairness)* | No transparency commitment for public-sector AI. | Transparency principle stated. | Operational register of public-sector AI use, or planned national centre for algorithmic transparency (Brazil's Action 51 National Centre for Algorithmic Transparency). |
| `dem_election_or_disinfo_instruments` | Not addressed. | Mentioned at principle level. | Named operational instruments against disinformation or for election integrity. |

### 5.3 Aspect 3: AI and Social Cohesion (`cohesion_composite`) [report focus]

The Cohesion aspect is the v2 report's analytical core. The sub-indicators are anchored on the §4.6 four-anchor synthesis (cohesion as operational purpose; operational specificity; linguistic-substrate sovereignty; participation in design and governance) and on the §1.2 five sub-dimensions.

| Sub-indicator | 0 | 1 | 2 |
|---|---|---|---|
| `coh_structural_cohesion_pillar` | Cohesion is at the level of guiding principles only. | A sub-pillar in some Area addresses cohesion. | Cohesion is a central or near-central operational concern with a named framing (Brazil "AI for the Good of All"; Egypt "Inclusive AI"; France Humanism pillar first). |
| `coh_algorithmic_fairness_toolkit` *(overlap with Democracy §5.2 transparency register)* | Principles only. | An instrument is announced. | Operational open-source toolkit available for adoption (Singapore AI Verify is the corpus exemplar). |
| `coh_linguistic_substrate` *(overlap with Ethics §5.4 sovereign LLM)* | No sovereign-language model commitment. | Sovereign model named without paired sectoral data substrate. | Sovereign model paired with a sectoral data-sets initiative (Egypt's Initiative 3 Arabic-first models paired with Initiative 7 Sectoral Arabic Data Sets; Brazil PT-BR sovereign model paired with sovereign cloud and data work). |
| `coh_territorial_distribution` | Nationally anchored without explicit regional distribution. | Regional distribution announced. | Distributed hub network operational or near-operational (South Africa AIISA eleven-hub university network targeted by 2025). |
| `coh_digital_inclusion_cohorts` *(overlap with Jobs §5.1 workforce training)* | No cohort-coverage target. | Qualitative coverage commitment. | Numeric cohort targets including a marginal-population KPI (Egypt 26% marginal-population KPI plus 36% public-access KPI is the only marginal-population quantification in the corpus). |

### 5.4 Aspect 4: AI, Ethics and Human Development (`ethics_hd_composite`)

The Ethics and Human Development aspect measures the strategy's treatment of fundamental rights, regulatory regime, and explicit alignment with human-development frameworks.

| Sub-indicator | 0 | 1 | 2 |
|---|---|---|---|
| `eth_sovereign_llm` *(overlap with Cohesion §5.3 linguistic substrate)* | No sovereign LLM. | Sovereign model announced. | Sovereign model operational (Brazil PT-BR Action 9; France Mistral; India BharatGen; Egypt Arabic-first). |
| `eth_open_source_commitment` | No open-source commitment. | Open-source mentioned in principle. | Mandated open-source or open-weight commitment in named initiatives. |
| `eth_ai_act_or_equivalent` | No AI-specific statute or regulation. | Sector-based approach without dedicated statute. | EU AI Act anchoring or dedicated AI statute (France, Finland, Portugal anchor on EU AI Act; Brazil Bill 2338/23 pending counts as 1; USA executive-order-based counts as 1). |
| `eth_ethics_body_operational` *(overlap with Democracy §5.2 civil society in ethics body)* | No ethics body. | Ethics body announced. | Operational ethics body with civil-society participation. |
| `eth_human_development_alignment` | HDI or human-development framework not named. | Referenced. | Central metric or framing (India's Viksit Bharat@2047 alignment; Brazil's social-democratic anchoring; France's Humanism pillar). |

## 6. Overlapping sub-indicators (caveat #3)

Three sub-indicators are deliberately scored once per country and contribute to two aspect composites. The same value lives in both columns in the CSV (or is referenced once and read by both aspects, depending on storage). The overlap is documented here so the user, the assessor, and any future analyst can see the same instrument is doing double duty in two aspects.

| Sub-indicator | Primary aspect | Secondary aspect | Why it serves both |
|---|---|---|---|
| `jobs_distributional_monitoring` / `coh_distributional_monitoring` | Jobs (§5.1) | Cohesion (§5.3) | Therborn (2009) treats labour-market distributional effects as a primary cohesion driver via the *distantiation* mechanism. The instrument is a labour-policy instrument; its cohesion effect is operational, not derivative. |
| `dem_transparency_register` / `coh_algorithmic_fairness_toolkit` | Democracy (§5.2) | Cohesion (§5.3) | A transparency register and an algorithmic-fairness toolkit are partially overlapping instruments: both make public-sector AI auditable. Brazil's planned Action 51 National Centre and Singapore's AI Verify both qualify; the cohesion frame and the democracy frame both consume them. |
| `coh_linguistic_substrate` / `eth_sovereign_llm` | Cohesion (§5.3) | Ethics & HD (§5.4) | A sovereign LLM is at once a cohesion instrument (cultural-linguistic representation) and a human-development instrument (digital sovereignty). The substrate-paired version (Cohesion §5.3) is the stricter score; the sovereign-LLM existence score (Ethics §5.4) is the looser one. |
| `dem_civil_society_in_ethics_body` / `eth_ethics_body_operational` | Democracy (§5.2) | Ethics & HD (§5.4) | A civil-society-represented ethics body is the institutional carrier of both the democratic-legitimacy purpose and the human-development purpose. |

The CSV stores each underlying score once and exposes it under the column names of both aspects (column aliases). The composite formula in §7 reads from the union of declared sub-indicators per aspect.

## 7. Composite-score formula

Each aspect composite is computed from its five sub-indicators (ordinal 0, 1, or 2; sum range 0 to 10) by simple band:

| Sum of sub-indicators | Composite (0-3) |
|---|---|
| 0 to 2 | 0 |
| 3 to 4 | 1 |
| 5 to 7 | 2 |
| 8 to 10 | 3 |

The composite is robust to single-dimension outliers and gives the map a four-band scale that is honest about the underlying granularity (any composite has a published rubric trail back to five integer scores).

## 8. Honest-scoring discipline

Three rules that govern how I apply the rubric.

1. **Document scope, not country scope.** The score reflects what the named primary document commits to. If a country has a strong domestic AI ecosystem but the document does not address a dimension, the score is 0 (or 1, never higher) and `source_notes` flags it.
2. **Most-binding-source rule.** Where a country has multiple AI-relevant documents, I use the most recent operational document as the primary source. Older or superseded documents are referenced in `source_notes` if they materially change the score.
3. **No interpolation across years.** Public indicators use whatever year is the latest available per country, but I do not impute or interpolate. Missing values are left explicitly `null` in the CSV and surfaced as such on the map.

## 9. Sample sanity-check countries

Before applying the rubric to all 23 rows, four countries are scored first as range-setters. These four are chosen to span the score range and the four aspect families:

| Country | Why it is a range-setter |
|---|---|
| Portugal | Focal subject; baseline for every dimension; mid-low cohesion composite expected (the report's argument). |
| Brazil | Likely top of the cohesion and democracy composites (PBIA "AI for the Good of All", 117-institution governance, 50% women target). |
| USA | Likely bottom of the cohesion and democracy composites (cohesion as derivative; civic-participation low; DEI references stripped); but top of `eth_human_development_alignment` if the frontier-leadership framing is read narrowly. |
| China | Tests the rubric's handling of authoritarian developmentalism: high productivity and infrastructure scores, low or zero on civic participation and civil-society representation. |

The user signs off on the four range-setter scorings (or asks me to revise specific dimensions) before I apply across the remaining nineteen.

## 10. Output files

- `rubric.md` (this file): the rulebook. Read this before reading any score.
- `countries.csv`: the 23-row dataset. Flat, no nesting, ready for any choropleth or filter layer.
- `notes.md` (companion): per-country notes that did not fit in CSV cells (multi-document scopes, document-supersession history, anomalies the scorer flagged).
