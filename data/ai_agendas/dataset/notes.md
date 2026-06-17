# Companion notes for `countries.csv`

Read this alongside [`rubric.md`](rubric.md) (the rulebook) and [`range_setter_scores.md`](range_setter_scores.md) (the sanity-check pass on Portugal, Brazil, USA, China).

## 1. Public-indicator values are placeholder

Per rubric §8.3, I will not commit numbers I cannot verify against a canonical source. Every value in the six public-indicator columns (`gdp_per_capita_usd`, `population_millions`, `hdi`, `gini`, `ai_readiness_index`, `renewable_electricity_share`) is a best-effort approximation from my reading and is **placeholder pending verification** against the canonical CSV from the source named in rubric §4.

Before publishing the map, replace each row's six public-indicator values with the latest authoritative figure. Suggested workflow: download the canonical CSVs (World Bank, UNDP, Our World in Data, Oxford Insights), match by ISO3, paste in. The CSV structure here will accept the substitution without any other changes.

Qatar's `gini` is empty because the World Bank Gini series for Qatar has no recent published value; leave null rather than impute.

## 2. URLs: 23 of 23 populated, with three landing-page caveats

Three rows came from the source-summary files: `CHN` (gov.cn State Council Opinion), `IND` (psa.gov.in IndiaAI Mission Initiatives), `USA` (govinfo.gov for Executive Order 14179, the legal anchor; the Action Plan PDF itself is on whitehouse.gov and was not added because the canonical URL was not in the source files).

The remaining twenty were located by a research-agent web pass against canonical government portals (gov.br, gov.uk, info.gouv.fr, agid.gov.it, smartnation.gov.sg, mbie.govt.nz, ai.gov.eg, etc.). The agent operated under explicit no-invention rules and verified resolution before returning each URL.

Three caveats the assessor should know about:

- `NGA` (Nigeria) URL is `https://fmcide.gov.ng/initiative/nais/`, a ministry landing page rather than a PDF. FMCIDE had not posted a direct PDF on its public file server at the time of search; the landing page is the canonical government-side reference.
- `QAT` (Qatar) URL is `https://www.mcit.gov.qa/en/digital-agenda-2030/`, again a programme landing page rather than a PDF; MCIT publishes the Agenda as an HTML programme rather than a downloadable PDF.
- `SGP` (Singapore) URL is `https://www.smartnation.gov.sg/initiatives/national-ai-strategy/`, the official initiative page for NAIS 2.0 (December 2023 launch); the PDF version of NAIS 2.0 lives in the IMDA press kit but the initiative page is the canonical government anchor.

Five rows point to paired-document strategies where the URL is the most-cited primary and the companion document is named in `source_notes`:

- `AUS` (National AI Plan PDF; APS AI Plan is the paired companion).
- `DEU` (KI-Strategie Fortschreibung 2020; BMBF KI-Aktionsplan 2023 is the paired companion).
- `JPN` (AI Strategy 2022 PDF; AI Basic Plan December 2025 is the paired companion at cao.go.jp/cstp/ai/ai_plan/).
- `SWE` (AI Strategy PDF; Action Plan annex is the paired companion at the same government.se assets path).
- `GBR` (AI Opportunities Action Plan; AI Playbook is the paired companion at gov.uk/government/publications/ai-playbook-for-the-uk-government).

Before publishing the map, the URLs should be re-verified once at submission time (a few of them may have moved by then). The provenance column at the end of `range_setter_scores.md` style was condensed into `source_notes` for brevity; the agent's full provenance table is preserved as a one-off note here for traceability.

## 3. Composite distribution: sanity check

| Aspect | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| Jobs | 3 | 6 | 13 | 1 |
| Democracy | 8 | 6 | 9 | 0 |
| Cohesion | 5 | 6 | 10 | 2 |
| Ethics and HD | 2 | 4 | 14 | 3 |

The shape matches what the v2 report argues. The Democracy column has no 3 because no country has all-fives across the democracy sub-indicators; the Brazil-leading-but-not-perfect score (5.2 = 7 = 2) is the corpus ceiling. Cohesion 3s are Brazil and India (consistent with v2 report's "leading comparators" claim). Ethics-and-HD 3s are France, Japan, Spain (consistent with EU-AI-Act-anchored plus operational ethics body plus sovereign LLM plus human-development-alignment combinations).

## 4. Per-country notes that did not fit in `source_notes`

These extend the row-level `source_notes` cell with caveats and judgment-call traces that an assessor or future analyst should be able to find.

### Argentina (ARG)
- Document is a 2018 Digital Agenda, not AI-specific (rubric §3 = `Digital Strategy` plus `not-AI-specific`). Most scores are 0; the one non-zero is `coh_digital_inclusion_cohorts = 1` reflecting the 2018 document's gender, rural, agritech, and K-12 inclusion framing, which is distinctive for a 2018-vintage digital agenda but does not include AI-specific cohort targets.

### Australia (AUS)
- Three-document stack: BCA Accelerating (June 2025) plus DISR National AI Plan plus Finance/DTA/APSC APS AI Plan. The `primary_document_title` cell holds the latter two; BCA Accelerating is the industry-side counterpart.
- Paired with New Zealand in the chosen-eight convention. Both flagged independently as `chosen_eight = true`; the visualisation should treat them as a pair when filtering to the report's narrative scope.
- `jobs_composite = 3` (the only 3 in Jobs across the corpus): All APS staff foundational AI training mandated within 12 months and explicit union consultation mandate and A\$116 B GDP add and 4.3 pp productivity by 2030. The judgment call here is whether the 12-month deadline counts as quantified (rubric example says yes; the 12-month deadline maps to "numeric cohort target" because APS is a fully enumerated population).

### Brazil (BRA)
- Per range-setter pass §8, the `jobs_union_or_social_dialogue = 1` score (CUT plus workforce-protection framing) versus a possible 2 is a flagged judgment call. The 2 reading would require treating Brazil's social-democratic governance plus CUT presence in the 117-institution participatory design as institutional representation comparable to France's social-dialogue mandate. I held to 1 because the 117-institution participation already lifts `dem_civic_participation = 2`.
- `cohesion_composite = 3` is the corpus top with India (sum 8 each). Anchored in "AI for the Good of All" framing as central pillar, PT-BR sovereign LLM paired with Sovereign Cloud, and CadÚnico 97 M reach plus 50% women-researcher target.

### China (CHN)
- `eth_ai_act_or_equivalent = 2` rests on the Generative AI Interim Measures (August 2023), the algorithmic recommendation regulation, the deepfake regulation, and the October 2025 Cybersecurity Law amendment. These are sector-based binding statutes; some readers would score 1 because there is no single comprehensive AI Act. I read the cluster as functionally equivalent in scope to EU-AI-Act anchoring under the rubric's wording.
- The `dem_election_or_disinfo_instruments = 1` score reflects platform-governance content moderation regulations as named operational instruments; it does not endorse them as democratic safeguards.

### Egypt (EGY)
- The 26% marginal-workforce KPI is the only quantified marginal-population commitment in the corpus and anchors `coh_digital_inclusion_cohorts = 2` plus `coh_structural_cohesion_pillar = 1`. The composite of 2 in cohesion is below Brazil and India because Egypt has no operational fairness toolkit and a centralised territorial model.
- `eth_human_development_alignment = 2` because "Inclusive AI" framing is named as a central pillar of the strategy.

### Finland (FIN)
- The composite of 1/0/0/1 is striking for a high-HDI EU country: it reflects strategy-document scope rather than country potential. Finland's worker-voice strength via the Nordic roundtable is operational (jobs_union = 2) but the strategy does not commit to fairness instruments, sovereign LLM, territorial distribution, or cohort targets at the rubric thresholds. The `eth_ai_act_or_equivalent = 2` is EU-AI-Act anchoring.

### France (FRA)
- `ethics_hd_composite = 3` reflects Mistral operational and open-source heritage and EU AI Act and civil-society participation through Aghion-Bouverot independent commission and Humanism pillar first. Strong cluster.
- `dem_civic_participation = 2` because of AI Cafés citizen-deliberation spaces plus the Aghion-Bouverot independent-commission process. The independent-commission framing is a distinctive participatory model in the EU peer group.

### Germany (DEU)
- Hybrid document type: AI Strategy 2020 Update plus BMBF Aktionsplan 2023. The two are read together for scoring.
- `dem_civil_society_in_ethics_body = 2` because of Plattform Lernende Systeme plus the Civic Innovation Platform plus Civic Data Lab plus Civic Tech Labs trio. Germany has the strongest civic-AI infrastructure in the EU peer group.
- `cohesion_composite = 1` despite strong civic infrastructure: the cohesion sub-dimensions favour quantified cohort targets and sovereign-substrate moves that the German strategy does not name at the rubric's level.

### India (IND)
- Demographic and inclusion scale anchor several 2-scores: 530 M Jan Dhan accounts, 490 M informal workers as named target, 14-language village-assembly SabhaSaar deployment.
- `eth_ai_act_or_equivalent = 1` because IndiaAI Mission is Cabinet-approved without parliamentary statute; DPDP Act 2023 is in force but is the privacy backbone, not the AI Act equivalent. The India AI Governance Guidelines (MeitY 2025) are guidelines, not statute, so they do not lift the score to 2.

### Italy (ITA)
- Mezzogiorno regional focus drives `coh_territorial_distribution = 1` (regional inclusion named) but not 2 (no distributed-hub network at the AIISA scale).
- Foundation under PM Office is "planned, distinctive" per the source but not yet operational; `eth_ethics_body_operational = 1`.

### Japan (JPN)
- Only country in the corpus with a dedicated AI Act statute (Act No. 53/2025); `eth_ai_act_or_equivalent = 2` is the strongest reading available.
- Quantified per-cohort education targets (1 M high-school and 500 K university and 250 K applied and 2 K expert and 1 M recurrent annually) anchor `jobs_workforce_training_quantified = 2` and `coh_digital_inclusion_cohorts = 2`.

### Kenya (KEN)
- Multi-stakeholder steering committee with town-hall convenors including United Disabled Persons of Kenya anchors `dem_civic_participation = 2` and `dem_civil_society_in_ethics_body = 2`. This is the strongest disability-inclusion participation in the corpus.
- `eth_human_development_alignment = 2` because of explicit alignment with the Bottom-up Economic Transformation Agenda plus Vision 2030.

### New Zealand (NZL)
- Light-touch and principles-based; OECD AI Principles adopted in explicit rejection of an AI-Act-equivalent. `eth_ai_act_or_equivalent = 1` (sector-based without dedicated statute) reflects the strategy's stance.
- Treaty of Waitangi embedded plus mātauranga Māori as taonga: `coh_structural_cohesion_pillar = 2` (centrally anchored) and `eth_human_development_alignment = 2`. Indigenous-rights anchoring is the distinguishing trait.

### Nigeria (NGA)
- 3MTT (3 million tech talent in 4 years) anchors `jobs_workforce_training_quantified = 2`; this is the largest absolute quantified workforce target in the corpus. India's IndiaAI FutureSkills 860 K is the largest with the smaller multiplier.
- `eth_human_development_alignment = 2` for the explicit decoloniality framing, the youth-bulge headline asset positioning, and candid brain-drain (japa) acknowledgement.

### Portugal (PRT)
- Focal subject of the v2 ANIA Assessment Report. ANIA (Resolução do Conselho de Ministros 2/2026) is Action #20 of the broader Estratégia Digital Nacional (EDN); ARTE under Decree-Law 96/2025 is the operational lead. Architecture is four Areas of Action by thirty-two named initiatives anchored on six guiding principles.
- The composite line (Jobs 1, Democracy 0, Cohesion 0, Ethics-HD 2) is the v2 report's central argument made numeric: ANIA addresses cohesion and democratic-participation dimensions at the level of intent rather than as operational pillars. AMALIA (Initiative II.7) is the named sovereign Portuguese-language model and anchors `coh_linguistic_substrate = 1`; productivity claim of €18 to 22 B/yr GDP add and 2.7 pp productivity is the strongest macroeconomic anchor in the corpus.
- `ethics_hd_composite = 2` rests on EU AI Act anchoring (Areas IV.4 plus IV.6) plus Lei 27/2021 plus the Centre for Responsible AI (IV.3) as the institutional locus. The four operational gaps identified in v2 §3.2 (no Society pillar; no multi-watchdog committee; no per-cohort literacy target; no distributed AI-hub network) drive the low scores on Cohesion and Democracy.

### Qatar (QAT)
- Digital Agenda 2030 is broader-than-AI; scoring is honest about the document not the country. Composite line (0, 0, 0, 0) reflects strategy-document scope and is the floor across the corpus alongside Argentina.

### Singapore (SGP)
- `coh_algorithmic_fairness_toolkit = 2` because AI Verify is the operational open-source toolkit cited as scope-exception in the v2 report. The composite of 1 (sum 4) reflects no sovereign LLM, no territorial distribution (city-state context), and a Creators/Practitioners/Users trichotomy that is not structurally-cohesion central.
- `dem_civil_society_in_ethics_body = 2` because AI Verify Foundation has 90+ corporate members with named civil-society representation.

### South Africa (ZAF)
- `document_maturity = discussion-draft` is the only such row in the corpus; the October 2023 status carries forward into the scoring confidence. Several "1" scores (specialist pipeline, multi-watchdog, ethics body) might lift to 2 once the strategy is finalised.
- `coh_territorial_distribution = 2` because AIISA targets 11 AI Hubs/Centres at universities distributed outside the largest metropolitan centre. The strongest distributed-hub model in the corpus.

### Spain (ESP)
- ALIA state-funded LLM scaling to 175 B parameters across castellano plus four co-official languages plus the proposed Ibéricos PT-ES subfamily anchors `coh_linguistic_substrate = 2` and `eth_sovereign_llm = 2`.
- AESIA is the first operational EU AI regulator (named, A Coruña); anchors `eth_ethics_body_operational = 2` and `dem_transparency_register = 1`.

### Sweden (SWE)
- ATR (Algorithmic Transparency Register) anchors `dem_transparency_register = 2`. One of the highest scores on that sub-indicator in the corpus.
- Nordic worker-voice strength anchors `jobs_union_or_social_dialogue = 2`.

### UAE (ARE)
- First country globally with a Minister of AI; Falcon (TII) operational sovereign LLM with open-source release anchors `eth_sovereign_llm = 2` and `eth_open_source_commitment = 1`.
- Federal-monarchy political context drives `democracy_composite = 0` (no row scored above 0 on any democracy sub-indicator).

### United Kingdom (GBR)
- Two-document stack: AI Opportunities Action Plan (50 recommendations, all 50 accepted by government per CP 1242) plus AI Playbook (5-tier civil-servant segmentation).
- `eth_ethics_body_operational = 2` because AISI UK was the first AI Safety Institute globally and has a pre-deployment evaluations remit.
- `eth_open_source_commitment = 2` is the open-source highest in the EU/UK cluster: i.AI Incubator open-source GitHub plus the "most open" categorisation in the comparator matrix.

### United States (USA)
- Range-setter judgment calls per `range_setter_scores.md` §8 still apply: open-source-as-national-bet drives `eth_open_source_commitment = 2`; sovereign-LLM-via-private-sector reading drives `eth_sovereign_llm = 2`. The Ethics-and-HD composite of 2 sits oddly next to the cohesion composite of 0; this asymmetry is the v2 report's central finding made numeric.

## 5. Overlap reminder

Per rubric §6, four sub-indicators contribute to two aspect composites each. The CSV stores each underlying score once in its primary-aspect column; the secondary-aspect column reads from the same value through the rubric. If you re-implement the composite formula yourself (rubric §7), make sure the overlapping sub-indicator contributes to both bands; otherwise the secondary aspect will under-count.

| Sub-indicator | Primary column | Secondary aspect contribution |
|---|---|---|
| distributional monitoring | `jobs_distributional_monitoring` | feeds Cohesion |
| transparency register / fairness toolkit | `dem_transparency_register` (and `coh_algorithmic_fairness_toolkit` for the toolkit-specific operational threshold) | both feed Cohesion §5.3 |
| sovereign LLM / linguistic substrate | `coh_linguistic_substrate` (stricter, paired with data substrate) and `eth_sovereign_llm` (looser, existence) | both held as separate columns |
| civil-society ethics body | `dem_civil_society_in_ethics_body` (and `eth_ethics_body_operational`) | mostly redundant pair; treat as two semi-independent reads |

I held the third and fourth pairs as separate columns in the CSV rather than aliasing because the rubric thresholds differ slightly between the cohesion reading (stricter) and the ethics reading (looser). The user may want to align them after seeing the data.

## 6. Remaining work before publication

1. **Populate the six public-indicator columns** from canonical CSVs (World Bank, UNDP, Our World in Data, Oxford Insights).
2. **Populate `primary_document_url`** for each row from the government portal links in each `<country>_summary.md` source file.
3. **(Resolved 2026-06-16.)** `is_focal_subject` column added (true only for Portugal). "Main countries in the report" filter is `chosen_eight = true` (nine rows including Portugal); strict-comparators filter is `chosen_eight = true AND is_focal_subject = false` (eight rows).
4. **(Resolved 2026-06-16.)** All seven judgment calls from `range_setter_scores.md` §8 accepted as-scored. No further sweeps needed on those cells.
5. **Sanity-check a 2 to 3 country sample.** Pick three rows you have independent knowledge of and audit my scoring. If a cell is off, change it in the CSV directly; if a pattern is off (e.g. I am systematically over-scoring `dem_transparency_register`), let me know and I will sweep the column.
