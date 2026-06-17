// chat-map-bridge.js — wire the Assistant's tool calls to map state mutations.
//
// The chat panel (chat.js) dispatches `aigeo:chat-tool-call` CustomEvents on
// window for every tool_call_start. This module listens for those events and
// translates them into calls on the public window.aigeo surface (defined at
// the bottom of app.js). No imports; runs as a vanilla module.
//
// Tool-to-action mapping (matches ARCHITECTURE.md §9):
//   get_country_profile({iso3})         -> aigeo.toggleCountry(iso3)
//   get_country_source_summary({iso3})  -> aigeo.toggleCountry(iso3)
//   get_indicator_explainer({slug})     -> aigeo.selectIndicator(`ania_agendas:${slug}`)
//   compare_countries({iso3_a, iso3_b}) -> select A (the existing map model is single-country)
//   query_scores / list_* / rubric      -> no map action (silent)

const INDICATOR_DATASET_PREFIX = "ania_agendas";

function findCatalogIdForSlug(slug) {
  if (!window.aigeo || typeof window.aigeo.catalog !== "function") return null;
  const cat = window.aigeo.catalog();
  // Try a direct match on the suffix; the catalog entry id format is
  // "<dataset>:<slug>", and the dataset id is configured in app.js DATASETS.
  const direct = cat.find((c) => c.id === `${INDICATOR_DATASET_PREFIX}:${slug}`);
  if (direct) return direct.id;
  // Fallback: match by slug suffix.
  const bySuffix = cat.find((c) => c.id.endsWith(`:${slug}`));
  return bySuffix ? bySuffix.id : null;
}

function selectCountrySafe(cca3) {
  if (!window.aigeo || typeof window.aigeo.toggleCountry !== "function") return;
  if (!window.aigeo.isCountryInCatalog(cca3)) return;
  if (window.aigeo.getSelected() === cca3) return; // already selected
  window.aigeo.toggleCountry(cca3);
}

function selectIndicatorSafe(slug) {
  if (!window.aigeo || typeof window.aigeo.selectIndicator !== "function") return;
  const id = findCatalogIdForSlug(slug);
  if (!id) return;
  const active = window.aigeo.getActiveIndicatorIds();
  if (active.includes(id)) return; // already active
  window.aigeo.selectIndicator(id);
}

function handleToolCall(ev) {
  const { tool, input } = ev.detail || {};
  if (!tool) return;
  switch (tool) {
    case "get_country_profile":
    case "get_country_source_summary":
      if (input && input.iso3) selectCountrySafe(input.iso3);
      break;
    case "get_indicator_explainer":
      if (input && input.slug) selectIndicatorSafe(input.slug);
      break;
    case "compare_countries":
      // Single-country selection model: focus the first country. The second
      // appears in the chat-panel response; future work can extend the map to
      // multi-highlight.
      if (input && input.iso3_a) selectCountrySafe(input.iso3_a);
      break;
    default:
      // list_countries, list_indicators, query_scores, get_rubric_section: no
      // map action by design (they are pure data queries).
      break;
  }
}

window.addEventListener("aigeo:chat-tool-call", handleToolCall);
