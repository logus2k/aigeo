# Indicator: AI and Democracy (composite)

**Slug:** `ania-democracy-composite`  
**Type:** composite (0-3 ordinal, banded from sum of five sub-indicators)  
**Data file:** `ai_agendas/ania-democracy-composite.json`

## Definition

Measures the strategy's treatment of public-sector AI legitimacy: who participates in the design, who oversees deployment, who can scrutinise outcomes, and what instruments exist against disinformation or election interference. Composite is the sum (0-10) of five sub-indicators (each 0-2) banded into a 0-3 scale.

## Score ladder

| Score | Verbal anchor | Sum of five sub-indicators (each 0-2) |
|---|---|---|
| 0 | absent or principle-level | 0 to 2 |
| 1 | limited operational presence | 3 to 4 |
| 2 | strong operational presence | 5 to 7 |
| 3 | central operational concern | 8 to 10 |

## Sub-indicators aggregated

This composite sums the following five sub-indicators (each 0-2):

- **Civic participation** (`ania-democracy-civic-participation`)
- **Multi-watchdog oversight** (`ania-democracy-multi-watchdog`)
- **Civil society in ethics body** (`ania-democracy-civil-society-ethics`)
- **Transparency register** (`ania-democracy-transparency-register`)
- **Election or disinformation instruments** (`ania-democracy-election-disinfo`)

## Country ranking

| Rank | Country | ISO3 | Score | Verbal anchor |
|---|---|---|---|---|
| 1 | Australia | AUS | 2 | strong operational presence |
| 1 | Brazil | BRA | 2 | strong operational presence |
| 1 | France | FRA | 2 | strong operational presence |
| 1 | Germany | DEU | 2 | strong operational presence |
| 1 | India | IND | 2 | strong operational presence |
| 1 | Kenya | KEN | 2 | strong operational presence |
| 1 | Singapore | SGP | 2 | strong operational presence |
| 1 | Sweden | SWE | 2 | strong operational presence |
| 1 | United Kingdom | GBR | 2 | strong operational presence |
| 10 | Italy | ITA | 1 | limited operational presence |
| 10 | Japan | JPN | 1 | limited operational presence |
| 10 | New Zealand | NZL | 1 | limited operational presence |
| 10 | Nigeria | NGA | 1 | limited operational presence |
| 10 | South Africa | ZAF | 1 | limited operational presence |
| 10 | Spain | ESP | 1 | limited operational presence |
| 16 | Argentina | ARG | 0 | absent or principle-level |
| 16 | China | CHN | 0 | absent or principle-level |
| 16 | Egypt | EGY | 0 | absent or principle-level |
| 16 | Finland | FIN | 0 | absent or principle-level |
| 16 | Portugal | PRT | 0 | absent or principle-level |
| 16 | Qatar | QAT | 0 | absent or principle-level |
| 16 | UAE | ARE | 0 | absent or principle-level |
| 16 | United States | USA | 0 | absent or principle-level |

## Exemplars

**Top of rank (score 2, strong operational presence):** Australia, Brazil, France, Germany, India.

**Bottom of rank (score 0, absent or principle-level):** Argentina, China, Egypt, Finland, Portugal.

## Cross-references

- Data file (JSON): `../ania-democracy-composite.json` (used by the aigeo map renderer).
- Per-country profiles: `../profiles/<iso3>.md` (drill-down for each country's full scoring).
- Source rubric: `../dataset/rubric.md` (full scoring methodology, with overlap notes in §6 and the composite formula in §7).
