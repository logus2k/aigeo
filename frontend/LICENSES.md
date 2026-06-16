# Licenses & provenance

All rendering code (`js/projections.js`, `js/colorscale.js`, `js/app.js`) is
original to this project and is **MIT-licensed**.

## Third-party libraries — `vendor/`

- **jsPanel 4.1** (`vendor/jspanel/`) — floating detail panel.
  **License: MIT.** https://jspanel.de/

## Fonts — `fonts/`

- **Roboto** (Thin/Light/Regular/Medium/Bold `.ttf`) — UI font.
  **License: Apache-2.0.** https://fonts.google.com/specimen/Roboto

No dependency is licensed outside MIT / Apache-2.0.

## Map geometry — `data/world-50m.geojson`

- **Source:** Natural Earth, 1:50m Admin-0 Countries
  (https://www.naturalearthdata.com/ via the `nvkelso/natural-earth-vector` repo).
- **License:** **Public Domain** (Natural Earth places all data in the public
  domain — no permission needed, no attribution required).
- Slimmed for the web (~1.6 MB): coordinates rounded to 2 decimals, Kosovo
  re-coded `KOS` -> `UNK` to match the dataset, and the original 168 Natural Earth
  properties reduced to a curated, snake_cased subset per feature:
  - identity: `cca3` (join key), `iso2` (links to `images/countries/<iso2>.svg`),
    `iso_n3`, `fips`, `name`, `name_long`, `formal`, `abbrev`, `postal`, `wikidata`
  - grouping: `continent`, `region_un`, `subregion`, `region_wb`, `economy`, `income_grp`
  - label placement: `label_x`, `label_y`
  - `names`: localized country name in 26 languages, keyed by lang code
    (`en`, `es`, `fr`, `de`, `zh`, `ar`, `ru`, `pt`, `ja`, …)
- 242 features / 241 distinct country codes have polygons. ~13 dependencies
  (French overseas departments, Svalbard, Gibraltar, Bouvet, Cocos, Christmas I.,
  Tokelau, US minor islands, Bonaire) are not separate polygons at admin-0 — they
  render as part of their parent country.

## Indicator data — `../data/worldcountrydata/*.json`

- **Source:** worldcountrydata.com rankings, which cite the **World Bank World
  Development Indicators** database.
- Used here as factual reference data.

No dependency is licensed outside MIT / Apache-2.0; the only non-code asset is
public-domain geometry, which is more permissive than either.
