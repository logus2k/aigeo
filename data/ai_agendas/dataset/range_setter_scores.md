# Range-setter scoring: Portugal, Brazil, USA, China

Four-country sanity-check pass per rubric §9. Each ordinal score is presented with a one-sentence rationale traceable to the named primary document or the v2 report finding. The user signs off on individual scores (or flags items for revision); on sign-off I apply the rubric across the remaining nineteen.

Six items are flagged at the bottom as deliberate judgment calls for explicit user review.

## 1. Identity columns

| Field | Portugal | Brazil | USA | China |
|---|---|---|---|---|
| `iso3` | PRT | BRA | USA | CHN |
| `region` | Europe | Americas | Americas | APAC |
| `analyzed_in_report` | true | true | true | true |
| `chosen_eight` | true (focal) | true | true | false |
| `document_type` | AI Strategy | AI Strategy | AI Strategy | AI Strategy |
| `document_maturity` | cabinet-approved | operational | cabinet-approved | operational |
| `primary_document_title` | Agenda Nacional para a Inteligência Artificial (ANIA), January 2026 | Plano Brasileiro de IA (PBIA), *IA para o Bem de Todos*, 2024-2028 | America's AI Action Plan, *Winning the Race*, July 2025 | State Council Opinion on "AI+" Action, August 2025 |
| `primary_document_url` | *(to verify against the canonical gov.pt or ARTE portal link)* | *(to verify; gov.br portal)* | *(to verify; whitehouse.gov)* | *(to verify; gov.cn)* |
| `source_notes` | Focal subject of the v2 report. ANIA is Action #20 of the broader EDN; ARTE Decree-Law 96/2025 is the operational lead. | 117-institution participatory governance for design. Bill 2338/23 still pending in Congress. | EO 14179 anchored; CAIOC cross-agency body; partisan single-administration framing. DEI references actively removed from NIST AI RMF and federal procurement guidance. | State Council issued; NDRC coordination. Reading the "AI+" Opinion as primary, with the 2023 Generative AI Interim Measures and the algorithmic recommendation regulation as binding background statutes referenced in scoring §5.4. |

## 2. Public-indicator anchors (placeholder, verify before lock)

I am not committing these values per rubric §8.3 (no interpolation). Best-effort estimates below for shape-checking only; the user (or I) populate from the canonical CSVs before publication.

| Indicator | Portugal | Brazil | USA | China |
|---|---|---|---|---|
| `gdp_per_capita_usd` | ~26,000 | ~10,000 | ~76,000 | ~12,500 |
| `population_millions` | 10.3 | 215 | 335 | 1,410 |
| `hdi` | 0.874 | 0.760 | 0.927 | 0.788 |
| `gini` | ~33.0 | ~52.0 | ~41.0 | ~38.0 |
| `ai_readiness_index` | ~63 | ~62 | ~85 | ~70 |
| `renewable_electricity_share` | ~60% | 89.2% | ~22% | ~30% |

## 3. Aspect 1: AI and Jobs

| Sub-indicator | PRT | BRA | USA | CHN |
|---|---|---|---|---|
| `jobs_workforce_training_quantified` | 0 | 1 | 1 | 1 |
| `jobs_specialist_pipeline` | 1 | 1 | 1 | 1 |
| `jobs_union_or_social_dialogue` | 0 | 1 | 0 | 0 |
| `jobs_distributional_monitoring` *(overlap §5.3)* | 0 | 2 | 0 | 0 |
| `jobs_productivity_target_quantified` | 2 | 1 | 0 | 1 |
| **Sum** | **3** | **6** | **2** | **3** |
| **`jobs_composite` (0-3)** | **1** | **2** | **0** | **1** |

Rationale:
- **Portugal**: III.1 Doutor AP and III.2 National Smart Skills Framework address an advanced cohort but no numeric per-cohort target; no union structure; no distributional monitoring; €18-22 B/yr GDP add and 2.7 pp productivity is the productivity quantification (rubric example).
- **Brazil**: skills strands named without IndiaAI-scale numbers; Latin American social-democratic reference to workers but no France-style mandate; 50% women-researcher target is the binding distributional anchor; R\$23.03 B aggregate but no headline productivity %.
- **USA**: AI Workforce Research Hub at DOL and Labour Market Analysis Hub named; CAIO-led workforce track; no union representation; DEI removed; no productivity headline (frontier-dominance framing is qualitative).
- **China**: workforce strands and talent pipeline named in the "AI+" Opinion without numeric cohort targets equivalent to India; no independent union representation (single-party governance); no distributional monitoring across protected categories; strategic-mission framing with quantified GDP and productivity sectoral targets in adjacent 5-Year Plan but not in the "AI+" Opinion itself.

## 4. Aspect 2: AI and Democracy

| Sub-indicator | PRT | BRA | USA | CHN |
|---|---|---|---|---|
| `dem_civic_participation` | 0 | 2 | 0 | 0 |
| `dem_multi_watchdog_oversight` | 0 | 1 | 0 | 0 |
| `dem_civil_society_in_ethics_body` *(overlap §5.4)* | 0 | 1 | 0 | 0 |
| `dem_transparency_register` *(overlap §5.3)* | 0 | 2 | 1 | 0 |
| `dem_election_or_disinfo_instruments` | 0 | 1 | 1 | 1 |
| **Sum** | **0** | **7** | **2** | **1** |
| **`democracy_composite` (0-3)** | **0** | **2** | **0** | **0** |

Rationale:
- **Portugal**: no participatory drafting methodology; no multi-watchdog committee (v2 §2.2 gap); no AI Ethics Expert Group with civil-society participation; no algorithmic-transparency register; deepfake and disinformation not named in ANIA.
- **Brazil**: 117-institution participatory governance for design is the corpus exemplar; multi-watchdog distributed across ANPD plus sectoral plus the planned national centre; civil-society representation in strategy design; National Centre for Algorithmic Transparency planned (Action 51); referenced disinformation framing.
- **USA**: single-administration framing; no participatory drafting; sector-based oversight; bias references stripped from NIST AI RMF and federal procurement guidance; OMB M-25-22 procurement guidance gives a partial public-AI transparency layer (score 1, not 2); TAKE IT DOWN Act and DOJ Federal Rules of Evidence Rule 901(c) for deepfakes give an election/disinfo instrument layer (score 1).
- **China**: top-down State Council; no participatory mechanism; CAC and NDRC consolidated; no independent civil-society representation; no public register of state AI use; content-moderation regulations exist but framed as platform governance, scored 1 because they exist as named instruments.

## 5. Aspect 3: AI and Social Cohesion *(report focus)*

| Sub-indicator | PRT | BRA | USA | CHN |
|---|---|---|---|---|
| `coh_structural_cohesion_pillar` | 0 | 2 | 0 | 1 |
| `coh_algorithmic_fairness_toolkit` *(overlap §5.2)* | 0 | 1 | 0 | 0 |
| `coh_linguistic_substrate` *(overlap §5.4)* | 1 | 2 | 1 | 2 |
| `coh_territorial_distribution` | 0 | 1 | 0 | 1 |
| `coh_digital_inclusion_cohorts` *(overlap §5.1)* | 0 | 2 | 0 | 0 |
| **Sum** | **1** | **8** | **1** | **4** |
| **`cohesion_composite` (0-3)** | **0** | **3** | **0** | **1** |

Rationale:
- **Portugal**: cohesion at principle level only (v2 §2.6 finding); no fairness toolkit; AMALIA sovereign Portuguese model (II.7) but not paired with sectoral data substrate, scored 1; nationally anchored without explicit regional distribution; III.8 literacy mandate exists but no quantified per-cohort target. The composite 0 is the v2 report's central argument operationalised.
- **Brazil**: "AI para o Bem de Todos" is the title, cohesion is central (score 2); National Centre for Algorithmic Transparency planned but not yet operational toolkit; PT-BR sovereign LLM paired with Sovereign Cloud (Action 27) gives the substrate score 2; N/NE renewable data centres show regional distribution but not AIISA-style hub network; CadÚnico 97M reach plus 50% women target plus AI Olympiad gives the cohort score 2.
- **USA**: cohesion treated as derivative of competitiveness, not as operational pillar; no fairness toolkit (DEI removed); sovereign LLMs operational in private sector but not strategy-framed as a sovereignty initiative the way France or Brazil do, scored 1; no federal AI hub network for cohesion purposes (Senior Military Colleges as AI hubs are defence-oriented); no cohort targets.
- **China**: "common prosperity" framing in adjacent Party doctrine but cohesion not the operational pillar of the "AI+" Opinion, scored 1; no fairness toolkit; sovereign Chinese-language LLMs operational with rich substrate (Baidu Ernie, Alibaba Qwen, DeepSeek), scored 2; provincial AI hubs and "East-West Compute" coordination give some territorial distribution; no cohort targets matching the rubric.

## 6. Aspect 4: AI, Ethics and Human Development

| Sub-indicator | PRT | BRA | USA | CHN |
|---|---|---|---|---|
| `eth_sovereign_llm` *(overlap §5.3)* | 1 | 1 | 2 | 2 |
| `eth_open_source_commitment` | 0 | 1 | 2 | 1 |
| `eth_ai_act_or_equivalent` | 2 | 1 | 1 | 2 |
| `eth_ethics_body_operational` *(overlap §5.2)* | 1 | 1 | 0 | 1 |
| `eth_human_development_alignment` | 1 | 2 | 0 | 1 |
| **Sum** | **5** | **6** | **5** | **7** |
| **`ethics_hd_composite` (0-3)** | **2** | **2** | **2** | **2** |

Rationale:
- **Portugal**: AMALIA sovereign model named (II.7) not yet operational, scored 1; no open-source commitment (v2 §2.4 gap); EU AI Act anchored in Area IV.4 and IV.6 plus Lei 27/2021, scored 2; Centre for Responsible AI (IV.3) announced as institutional locus but no civil-society participation yet, scored 1; cohesion referenced in guiding principles but not central metric.
- **Brazil**: PT-BR sovereign LLM Action 9 announced not yet operational, scored 1; sovereign cloud and PT-BR have an open-source lean but not mandated, scored 1; Bill 2338/23 pending plus LGPD in force, scored 1; ethics body planned through the 117-institution governance not yet permanent, scored 1; "AI para o Bem de Todos" frame and social-democratic anchoring score 2 for human-development alignment.
- **USA**: OpenAI, Anthropic, Google, Meta operational, scored 2; open-source and open-weight named as a strategic priority (Plan p.4-5), scored 2; sector-based plus executive-order regime, explicitly anti-EU AI Act, scored 1; NIST AISI exists but bias references stripped and no civil-society participation, scored 0; frontier-dominance framing with HDI absent, scored 0.
- **China**: Baidu Ernie, Alibaba Qwen, DeepSeek operational, scored 2; DeepSeek and Qwen significant open-source releases but not strategy-mandated, scored 1; Generative AI Interim Measures (Aug 2023) plus algorithmic recommendation regulation plus deepfake regulation as sector-based binding statutes, scored 2; National AI Standards Committee exists without civil-society participation, scored 1; "common prosperity" referenced not central, scored 1.

## 7. Composite summary

| Country | Jobs | Democracy | Cohesion | Ethics and HD |
|---|---|---|---|---|
| Portugal | 1 | 0 | 0 | 2 |
| Brazil | 2 | 2 | 3 | 2 |
| USA | 0 | 0 | 0 | 2 |
| China | 1 | 0 | 1 | 2 |

The shape matches what the v2 report argues. Portugal scores low on Cohesion and Democracy, consistent with the report's central finding. Brazil leads on every aspect except sovereign-LLM operationality. USA scores 0 on three aspects out of four despite high HDI and AI-readiness numbers, which is the inverse correlation the v2 report makes explicit (regulatory and cohesion architecture is not a function of GDP per capita). China sits between the two for technological and regulatory infrastructure but is low on participation.

## 8. Six judgment calls flagged for your review

Items where reasonable people would score differently and where your reading should drive the lock.

1. **USA `eth_sovereign_llm = 2`** *(and China = 2)*. The rubric says "sovereign LLM operational" without distinguishing state-mandated from private-sector. OpenAI and Anthropic are American-headquartered and American-trained but are private companies, not sovereign initiatives the way Brazil's PT-BR Action 9 or France's Mistral are. Two readings: (a) the rubric is about whether a sovereign-language model exists and is operational, in which case USA and China score 2; (b) the rubric is about whether the *strategy* commits to sovereign-LLM sovereignty as a national bet, in which case USA scores 1 (open-source-as-national-bet is close) and China scores 2 (state-led "AI+" framing). I went with reading (a); flag if you want (b).
2. **USA `eth_open_source_commitment = 2`**. The Action Plan frames open-source / open-weight AI as a strategic priority (p.4-5). This is unusually strong for a national strategy. Score 2 is right per the rubric but it sits oddly next to the DEI-removed and HDI-absent framing. If you want the composite to reflect cohesion-and-ethics maturity rather than technological-openness, the open-source dimension may need to be moved out of the Ethics-and-HD aspect into a separate Technology aspect (would mean redesigning to five aspects).
3. **Portugal `eth_ethics_body_operational = 1`**. Centre for Responsible AI (IV.3) is announced. It is not yet operational; it has no civil-society participation commitment in the ANIA text. Score 1 is per the rubric. If you want operational-not-announced to be the test, this should drop to 0.
4. **China `dem_election_or_disinfo_instruments = 1` (and USA = 1)**. The rubric scores presence of named operational instruments. China's deepfake regulation and platform content moderation are operational instruments aimed at platform governance, not democratic election integrity. USA's TAKE IT DOWN Act and DOJ Rule 901(c) are operational. I scored both 1 (instruments exist). If you want the score to reflect *democratic election integrity* specifically rather than disinformation instruments broadly, China should drop to 0.
5. **Brazil `coh_digital_inclusion_cohorts = 2`**. CadÚnico 97M is a social-policy programme that PBIA references rather than an AI literacy cohort target. The 50% women-researcher target is an in-corpus quantified cohort. The AI Olympiad reaches a youth cohort. Score 2 is per the rubric reading. If you want strictly "AI literacy cohort targets, not adjacent social-policy reach", drop to 1.
6. **Portugal and USA `chosen_eight = true`**. Portugal is the focal subject; USA is one of the eight comparators. Both are true if the filter means "main countries considered in the report". If the filter means strictly "comparators (not focal)", Portugal would be `false` and a separate `is_focal_subject = true` column distinguishes it. I went with the first reading because that is what the v2 report's narrative scope says; flag if you want the second.

## 9. What I need from you

For each of the six items above: keep the score, change it, or flag for me to reconsider. For everything not in §8, default is approval.

Once you sign off (or after I revise on your feedback), I apply the rubric to the remaining nineteen countries and produce `countries.csv` plus `notes.md`.
