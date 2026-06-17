// app.js — interactive SVG choropleth (MIT, this project). No third-party libraries.
import { PROJECTIONS } from "./projections.js";
import { colorFor, makeNormalizer, NO_DATA } from "./colorscale.js";

// Relative paths so the app works both at the dev root (serve.py) and behind a
// reverse proxy on a sub-path (e.g. nginx /aigeo/). serve.py maps "/data/" to
// the project's data/ dir; the proxy strips its prefix before that reaches us.
const DATASETS = [
  { key: "worldbank", base: "data/worldcountrydata" },
  { key: "ania", base: "data/ai_agendas" },
];
const GEO_URL = "geo/world-50m.geojson";
const SVG_NS = "http://www.w3.org/2000/svg";
const W = 1000;        // nominal viewBox width; height is derived per projection

const state = {
  geo: null,
  catalog: [],         // flat list of indicator descriptors (both datasets)
  groups: [],          // panel groups: [{ key, label, items:[catalog entry] }]
  openGroups: new Set(),// keys of expanded panel groups
  activeIds: [],       // selected indicator ids: [colorId?, sizeId?] (0..2)
  layers: [],          // derived render layers for activeIds (see makeLayer)
  cache: {},           // catalog id -> loaded JSON
  projection: "equirectangular",
  scale: "percentile",
  scope: "ania23",     // country scope: "ania23" | "ania10" | "all"
  aniaCountries: new Set(), // cca3 of all ANIA dataset countries (built at load)
  labelsVisible: false,// country name labels on the map
  titleVisible: true, // map title (top-left) reflecting active indicators
  view: { x: 0, y: 0, w: W, h: W }, // viewBox (zoom/pan); h reset per projection
  fullH: W,            // unzoomed viewBox height for the current projection
  propsByCca3: {},     // cca3 -> geometry properties (name, region, iso2, …)
  profiles: {},        // cca3 -> { indicator -> {value, formatted, rank} }
  selected: null,      // cca3 of selected country, or null
  panel: null,         // country-detail jsPanel instance, or null
  panelSections: new Set(["wb", "ania"]),  // expanded sections in the country panel
  settingsPanel: null, // settings jsPanel instance, or null
  legendPanel: null,   // legend jsPanel instance, or null
  legendVisible: true, // whether the legend panel should be shown
  indicatorsPanel: null,   // indicators-list jsPanel instance, or null
  indicatorsVisible: true, // whether the indicators panel should be shown
  projectionsPanel: null,    // projections-list jsPanel instance, or null
  projectionsVisible: false, // whether the projections panel should be shown (off by default)
  moved: false,        // true if the last pointer gesture was a drag (suppress click)
};

const els = {};

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

// ---- geometry projection + fitting -----------------------------------------
const projCache = {}; // projectionKey -> { features:[{cca3,name,d}] }

function eachRing(geom, fn) {
  if (geom.type === "Polygon") geom.coordinates.forEach(fn);
  else if (geom.type === "MultiPolygon") geom.coordinates.forEach((poly) => poly.forEach(fn));
}

function buildProjected(key) {
  if (projCache[key]) return projCache[key];
  const project = PROJECTIONS[key].project;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  // First pass: project every point, track bounds.
  const projected = state.geo.features.map((f) => {
    const rings = [];
    eachRing(f.geometry, (ring) => {
      const pts = ring.map(([lon, lat]) => {
        const [x, y] = project(lon, lat);
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        return [x, y];
      });
      rings.push(pts);
    });
    return { cca3: f.properties.cca3, name: f.properties.name, rings };
  });
  // Second pass: scale tightly to width W (no margin); height follows the
  // projected aspect so the content fills the viewBox edge-to-edge.
  const s = W / (maxX - minX);
  const height = (maxY - minY) * s;
  const sx = (x) => ((x - minX) * s).toFixed(1);
  const sy = (y) => ((y - minY) * s).toFixed(1);
  const features = projected.map((f) => {
    let d = "";
    for (const ring of f.rings) {
      d += "M" + ring.map((p) => `${sx(p[0])},${sy(p[1])}`).join("L") + "Z";
    }
    return { cca3: f.cca3, name: f.name, d };
  });
  // Map an arbitrary lon/lat (e.g. a label centroid) into viewBox coords.
  const toXY = (lon, lat) => { const [x, y] = project(lon, lat); return [(x - minX) * s, (y - minY) * s]; };
  projCache[key] = { features, height, toXY };
  return projCache[key];
}

// ---- country scope ----------------------------------------------------------
// ANIA 10: the report's final selection (Portugal + 9 comparator rows; AUS & NZL
// are paired). ANIA 23: every country in the ANIA dataset (built at load).
const ANIA10 = new Set(["PRT", "AUS", "NZL", "BRA", "EGY", "FIN", "FRA", "IND", "ZAF", "USA"]);
const SCOPES = [["ania10", "ANIA 10"], ["ania23", "ANIA 23"], ["all", "All"]];
function inScope(cca3) {
  if (state.scope === "all") return true;
  if (state.scope === "ania10") return ANIA10.has(cca3);
  return state.aniaCountries.has(cca3);   // ania23
}

// ---- rendering --------------------------------------------------------------
const BUBBLE_RMAX = 23;   // max bubble radius in viewBox units (W = 1000)

// Derive a render layer from an indicator id: color t (for the choropleth) and
// size norm (for bubbles), scale-aware for ANIA ordinal indicators. Only the
// in-scope countries are considered (so scales adapt to the selected scope).
function makeLayer(id) {
  const doc = state.cache[id];
  if (!doc) return null;
  const cat = catEntry(id);
  const entries = doc.entries.filter((e) => inScope(e.cca3));
  const byId = {};
  for (const e of entries) byId[e.cca3] = e;
  const ordinal = (doc.unit || "").includes("ordinal");
  const values = entries.map((e) => e.value);
  const scaleMax = doc.statistics?.scale_max || (values.length ? Math.max(...values) : 1);
  const maxVal = values.length ? Math.max(...values) : 1;
  const normColor = ordinal ? null : makeNormalizer(values, state.scale);
  return {
    id, cat, doc, entries, byId, ordinal, scaleMax, maxVal,
    colorT: (cca3) => { const e = byId[cca3]; if (!e) return null; return ordinal ? e.value / scaleMax : normColor(e.value); },
    sizeNorm: (cca3) => { const e = byId[cca3]; if (!e) return null; return ordinal ? e.value / scaleMax : e.value / maxVal; },
  };
}

function renderMap() {
  const proj = buildProjected(state.projection);
  state.layers = state.activeIds.map(makeLayer).filter(Boolean);
  const colorLayer = state.layers[0] || null;
  const sizeLayer = state.layers.length === 2 ? state.layers[1] : null;

  const svg = els.svg;
  // With no indicator selected, countries are the light no-data grey — force
  // black borders (even on dark theme) so they stay visible.
  svg.classList.toggle("nodata", state.layers.length === 0);
  svg.innerHTML = "";
  for (const f of proj.features) {
    const t = colorLayer ? colorLayer.colorT(f.cca3) : null;
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", f.d);
    path.setAttribute("fill", t == null ? NO_DATA : colorFor(t));
    path.setAttribute("class", "country");
    path.dataset.cca3 = f.cca3;
    path.dataset.name = f.name;
    svg.appendChild(path);
  }
  // Bubbles (slot B) — sized by value, placed at country label centroids. They
  // live in a <g> kept as the last child so raising a selected/hovered country
  // never paints over them.
  if (sizeLayer) {
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("class", "bubbles");
    for (const e of sizeLayer.entries) {
      const props = state.propsByCca3[e.cca3];
      if (!props || props.label_x == null || props.label_y == null) continue;
      const norm = sizeLayer.sizeNorm(e.cca3);
      if (!norm || norm <= 0) continue;
      const r = Math.sqrt(norm) * BUBBLE_RMAX;
      const [x, y] = proj.toXY(props.label_x, props.label_y);
      const c = document.createElementNS(SVG_NS, "circle");
      c.setAttribute("cx", x.toFixed(1));
      c.setAttribute("cy", y.toFixed(1));
      c.setAttribute("r", r.toFixed(1));
      c.setAttribute("class", "bubble");
      g.appendChild(c);
    }
    svg.appendChild(g);
  }
  // Country labels (top group, scales with zoom). Off unless toggled in Settings.
  if (state.labelsVisible) {
    const lg = document.createElementNS(SVG_NS, "g");
    lg.setAttribute("class", "labels");
    for (const f of proj.features) {
      const props = state.propsByCca3[f.cca3];
      if (!props || props.label_x == null || props.label_y == null) continue;
      const [x, y] = proj.toXY(props.label_x, props.label_y);
      const t = document.createElementNS(SVG_NS, "text");
      t.setAttribute("x", x.toFixed(1));
      t.setAttribute("y", y.toFixed(1));
      t.setAttribute("font-size", "4");   // user units → scales with zoom
      t.setAttribute("class", "map-label");
      t.textContent = props.name || f.name;
      lg.appendChild(t);
    }
    svg.appendChild(lg);
  }
  applyViewBox();
  applySelection();   // re-highlight selected country after a fresh render
  refreshPanel();     // keep panel content in sync with the current selection
  syncLegend();       // show/hide + refresh the legend (hidden when nothing selected)
  updateProjections();// highlight the active projection in the projections list
  updateMapTitle();   // top-left title reflecting the active indicator(s)
}

// Top-left map title reflecting the selected indicators (color, and size if 2).
function updateMapTitle() {
  const el = els.mapTitle;
  if (!el) return;
  if (!state.titleVisible) { el.style.display = "none"; return; }
  el.style.display = "block";
  const layers = state.layers;
  if (!layers.length) { el.innerHTML = ""; return; }   // nothing selected → no title
  let inner;
  if (layers.length === 1) {
    inner = layers[0].cat.label;
  } else {
    // both indicators on a single line
    inner = `${layers[0].cat.label} <span class="title-role">color</span> · ` +
      `${layers[1].cat.label} <span class="title-role">size</span>`;
  }
  el.innerHTML = `<div class="map-title-main">${inner}</div>`;
}

// ---- legend panel -----------------------------------------------------------
const BUBBLE_RMAX_LEGEND = 15;  // max legend reference-circle radius (px)

function fmtClosest(entries, target) {
  let best = entries[0], bd = Infinity;
  for (const e of entries) { const d = Math.abs(e.value - target); if (d < bd) { bd = d; best = e; } }
  return best ? best.formatted : "";
}

// Color legend for slot A: discrete swatches for ordinal, gradient otherwise.
function colorLegendInner(layer) {
  if (layer.ordinal) {
    let sw = "";
    for (let v = 0; v <= layer.scaleMax; v++) {
      sw += `<span class="sw"><span class="sw-chip" style="background:${colorFor(v / layer.scaleMax)}"></span>${v}</span>`;
    }
    return `<div class="legend-title">${layer.cat.label} <span class="legend-role">color</span></div>
      <div class="legend-swatches">${sw}</div>`;
  }
  const nums = layer.entries.map((e) => e.value).filter((v) => typeof v === "number").sort((a, b) => a - b);
  const min = nums[0], max = nums[nums.length - 1], mid = nums[Math.floor(nums.length / 2)];
  const stops = [];
  for (let i = 0; i <= 6; i++) stops.push(colorFor(i / 6));
  return `<div class="legend-title">${layer.cat.label} <span class="legend-role">color</span></div>
    <div class="legend-bar" style="background:linear-gradient(to right,${stops.join(",")})"></div>
    <div class="legend-labels"><span>${fmtClosest(layer.entries, min)}</span><span>${fmtClosest(layer.entries, mid)}</span><span>${fmtClosest(layer.entries, max)}</span></div>`;
}

// Size legend for slot B: reference circles like a proportional-symbol key.
function sizeLegendInner(layer) {
  let refs;
  if (layer.ordinal) {
    refs = [];
    for (let v = 1; v <= layer.scaleMax; v++) refs.push({ norm: v / layer.scaleMax, label: String(v) });
  } else {
    refs = [1, 4 / 9, 1 / 9].map((n) => ({ norm: n, label: fmtClosest(layer.entries, layer.maxVal * n) }));
  }
  const rows = refs.map((rf) => {
    const d = 2 * Math.sqrt(rf.norm) * BUBBLE_RMAX_LEGEND;
    return `<div class="size-row"><span class="size-circle" style="width:${d.toFixed(0)}px;height:${d.toFixed(0)}px"></span><span class="size-lbl">${rf.label}</span></div>`;
  }).join("");
  return `<div class="legend-title">${layer.cat.label} <span class="legend-role">size</span></div>
    <div class="size-scale">${rows}</div>`;
}

function buildLegendHTML() {
  const n = state.layers.length;
  if (n === 0) return `<div class="legend-body"><div class="legend-note">Select an indicator in the Indicators panel.</div></div>`;
  if (n === 1) return `<div class="legend-body">${colorLegendInner(state.layers[0])}</div>`;
  return `<div class="legend-body">${colorLegendInner(state.layers[0])}<div class="legend-sep"></div>${sizeLegendInner(state.layers[1])}</div>`;
}

// Catalog helpers.
function catEntry(id) { return state.catalog.find((c) => c.id === id); }

// Build the flat catalog + ordered, collapsible panel groups from the dataset
// indexes. World Bank is one flat group; ANIA splits into its 4 categories.
function buildCatalog(indexes) {
  state.catalog = [];
  state.groups = [];
  const groupByKey = {};
  const ensureGroup = (key, label) => {
    if (!groupByKey[key]) { groupByKey[key] = { key, label, items: [] }; state.groups.push(groupByKey[key]); }
    return groupByKey[key];
  };
  indexes.forEach((idx, di) => {
    const dsKey = DATASETS[di].key;
    for (const i of idx.indicators) {
      const entry = {
        id: `${dsKey}:${i.indicator}`,
        datasetKey: dsKey,
        base: DATASETS[di].base,
        slug: i.indicator,
        label: i.label || i.indicator,
        category: i.category || null,
        count: i.count,
        iconKey: i.category ? `cat:${i.category}` : i.indicator,
      };
      state.catalog.push(entry);
      const gKey = i.category ? `${dsKey}:${i.category}` : dsKey;
      const gLabel = i.category ? `${idx.dataset_label || dsKey} · ${i.category}` : (idx.dataset_label || dsKey);
      ensureGroup(gKey, gLabel).items.push(entry);
    }
  });
  // Expand the first group by default so the panel isn't all-collapsed.
  if (state.groups[0]) state.openGroups.add(state.groups[0].key);
}

const LEGEND_MARGIN = 16;
// Pin the auto-width legend to the bottom-right corner using its measured size
// (jsPanel positions before the content width is known, so it can overflow).
function positionLegend() {
  const p = state.legendPanel;
  if (!p) return;
  const left = Math.max(LEGEND_MARGIN, window.innerWidth - p.offsetWidth - LEGEND_MARGIN);
  const top = Math.max(LEGEND_MARGIN, window.innerHeight - p.offsetHeight - LEGEND_MARGIN);
  p.style.left = left + "px";
  p.style.top = top + "px";
}

// Show the legend only when it's enabled AND at least one indicator is selected
// (no "nothing selected" placeholder — the panel just isn't shown).
function syncLegend() {
  const shouldShow = state.legendVisible && state.layers.length > 0;
  if (shouldShow) { openLegendPanel(); }
  else { hideLegendPanel(true); }   // auto-hide: keep the toggle state
}

function openLegendPanel() {
  if (state.legendPanel) {            // already open → just refresh content/position
    state.legendPanel.content.innerHTML = buildLegendHTML();
    positionLegend();
    return;
  }
  const jp = window.jsPanel;
  if (!jp) return;
  state.legendPanel = jp.create({
    headerTitle: "Legend",
    theme: "#3182bd",
    borderRadius: "8px",
    panelSize: { width: "auto", height: "auto" },
    position: "right-bottom -16 -16",
    headerControls: "closeonly",
    content: buildLegendHTML(),
    callback: () => requestAnimationFrame(positionLegend),  // place once content is measured
    onclosed: () => {
      state.legendPanel = null;
      if (!state._legendAutoClose) { state.legendVisible = false; syncSettingsLegendToggle(); }
      state._legendAutoClose = false;
    },
  });
}

// auto=true closes the panel without flipping the legend toggle off.
function hideLegendPanel(auto) {
  if (!state.legendPanel) return;
  state._legendAutoClose = !!auto;
  state.legendPanel.close();
}

function setLegendVisible(show) {
  state.legendVisible = show;
  syncSettingsLegendToggle();
  syncLegend();
}

// ---- indicators panel -------------------------------------------------------
// Inline line-icons (MIT / authored here) alluding to each indicator's subject.
const IND_ICONS = {
  // people / group
  population: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  // extent / expand corners (land area)
  area: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M16 21h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>',
  // dollar sign
  gdp: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  // person + dollar (wealth per person)
  "gdp-per-capita": '<circle cx="7" cy="6" r="3"/><path d="M2 20v-1a5 5 0 0 1 5-5 5 5 0 0 1 3 1"/><path d="M18 7v11M20.3 9.2H16.6a1.7 1.7 0 0 0 0 3.4h1.6a1.7 1.7 0 0 1 0 3.4H15.4"/>',
  // baby face
  "infant-mortality": '<circle cx="12" cy="12" r="9"/><path d="M9 11h.01M15 11h.01"/><path d="M9 15s1 1.3 3 1.3 3-1.3 3-1.3"/>',
  // heartbeat / pulse (life)
  "life-expectancy": '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  // open book
  "literacy-rate": '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  // briefcase (jobs)
  unemployment: '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  // ANIA category icons
  "cat:Jobs": '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  "cat:Democracy": '<path d="M3 21h18M5 21V10M19 21V10M9 21v-7M15 21v-7M12 3 4 8h16z"/>',
  "cat:Social cohesion": '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  "cat:Ethics & HD": '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
};
function indicatorIcon(key) {
  const inner = IND_ICONS[key] || "";
  return `<svg class="ind-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

function buildIndicatorsHTML() {
  const groups = state.groups.map((g) => {
    const open = state.openGroups.has(g.key);
    const items = g.items.map((c) => {
      const slot = state.activeIds.indexOf(c.id);   // -1 none, 0 color, 1 size
      const badge = slot === 0 ? '<span class="slot slot-a">color</span>'
        : slot === 1 ? '<span class="slot slot-b">size</span>' : "";
      return `<button class="ind-item${slot >= 0 ? " active" : ""}" data-id="${c.id}">
         <span class="ind-left">${indicatorIcon(c.iconKey)}<span class="ind-name">${c.label}</span></span>
         ${badge}<span class="ind-count">${c.count}</span>
       </button>`;
    }).join("");
    return `<div class="ind-group">
      <button class="ind-group-hdr${open ? " open" : ""}" data-group="${g.key}">
        <span class="ind-group-label">${g.label}</span><span class="ind-group-count">${g.items.length}</span>
      </button>
      <div class="ind-group-body"${open ? "" : " hidden"}>${items}</div>
    </div>`;
  }).join("");
  const scopeToggle = `<div class="scope-toggle">${SCOPES.map(([k, l]) =>
    `<button class="scope-btn${state.scope === k ? " active" : ""}" data-scope="${k}">${l}</button>`).join("")}</div>`;
  return `<div class="indicator-list">${scopeToggle}${groups}</div>`;
}

function refreshIndicatorsPanel() {
  if (state.indicatorsPanel) state.indicatorsPanel.content.innerHTML = buildIndicatorsHTML();
}

function setScope(scope) {
  state.scope = scope;
  refreshIndicatorsPanel();
  renderMap();
}

// Toggle indicator selection: max 2 (slot 0 = color, slot 1 = size); a 3rd pick
// drops the oldest. Clicking a selected one removes it.
function selectIndicator(id) {
  const i = state.activeIds.indexOf(id);
  if (i >= 0) state.activeIds.splice(i, 1);
  else { state.activeIds.push(id); if (state.activeIds.length > 2) state.activeIds.shift(); }
  refreshIndicatorsPanel();
  renderMap();
}

function openIndicators() {
  const jp = window.jsPanel;
  state.indicatorsVisible = true;
  syncSettingsIndicatorsToggle();
  if (state.indicatorsPanel || !jp) { refreshIndicatorsPanel(); return; }
  state.indicatorsPanel = jp.create({
    headerTitle: "Indicators",
    theme: "#3182bd",
    borderRadius: "8px",
    panelSize: { width: 330, height: 620 },
    position: "left-top 16 235",
    headerControls: "closeonly",
    content: buildIndicatorsHTML(),
    callback: (p) => {
      p.content.addEventListener("click", (e) => {
        const scopeBtn = e.target.closest(".scope-btn");
        if (scopeBtn) { setScope(scopeBtn.dataset.scope); return; }
        const hdr = e.target.closest(".ind-group-hdr");
        if (hdr) {
          const key = hdr.dataset.group;
          state.openGroups.has(key) ? state.openGroups.delete(key) : state.openGroups.add(key);
          refreshIndicatorsPanel();
          return;
        }
        const btn = e.target.closest(".ind-item");
        if (btn) selectIndicator(btn.dataset.id);
      });
    },
    onclosed: () => {
      state.indicatorsPanel = null;
      state.indicatorsVisible = false;
      syncSettingsIndicatorsToggle();
    },
  });
}

function closeIndicators() {
  state.indicatorsVisible = false;
  if (state.indicatorsPanel) { const p = state.indicatorsPanel; state.indicatorsPanel = null; p.close(); }
  syncSettingsIndicatorsToggle();
}

function setIndicatorsVisible(show) { show ? openIndicators() : closeIndicators(); }

// ---- projections panel ------------------------------------------------------
function buildProjectionsHTML() {
  const items = Object.entries(PROJECTIONS).map(([k, p]) =>
    `<button class="ind-item${k === state.projection ? " active" : ""}" data-proj="${k}">
       <span class="ind-left"><span class="ind-name">${p.label}</span></span>
     </button>`).join("");
  return `<div class="indicator-list">${items}</div>`;
}

function updateProjections() {
  if (!state.projectionsPanel) return;
  state.projectionsPanel.content.querySelectorAll(".ind-item").forEach((b) => {
    b.classList.toggle("active", b.dataset.proj === state.projection);
  });
}

function selectProjection(key) {
  if (!PROJECTIONS[key] || key === state.projection) return;
  state.projection = key;
  resetView();
  renderMap();
}

function openProjections() {
  const jp = window.jsPanel;
  state.projectionsVisible = true;
  syncSettingsProjectionsToggle();
  if (state.projectionsPanel || !jp) { updateProjections(); return; }
  state.projectionsPanel = jp.create({
    headerTitle: "Projection",
    theme: "#3182bd",
    borderRadius: "8px",
    panelSize: { width: 200, height: "auto" },
    position: "left-bottom 16 -76",
    headerControls: "closeonly",
    content: buildProjectionsHTML(),
    callback: (p) => {
      p.content.addEventListener("click", (e) => {
        const btn = e.target.closest(".ind-item");
        if (btn) selectProjection(btn.dataset.proj);
      });
    },
    onclosed: () => {
      state.projectionsPanel = null;
      state.projectionsVisible = false;
      syncSettingsProjectionsToggle();
    },
  });
}

function closeProjections() {
  state.projectionsVisible = false;
  if (state.projectionsPanel) { const p = state.projectionsPanel; state.projectionsPanel = null; p.close(); }
  syncSettingsProjectionsToggle();
}

function setProjectionsVisible(show) { show ? openProjections() : closeProjections(); }

// ---- zoom / pan via viewBox -------------------------------------------------
const LABEL_BASE = 4;   // label size (user units) at full view; W = 1000
// Keep labels a constant on-screen size: as the viewBox shrinks (zoom in),
// shrink the font in user units proportionally so it doesn't grow on screen.
function updateLabelSizes() {
  const k = state.view.w / W;
  const fs = (LABEL_BASE * k).toFixed(2);
  const sw = (1.0 * k).toFixed(3);   // halo so text reads over any fill
  els.svg.querySelectorAll(".map-label").forEach((t) => {
    t.setAttribute("font-size", fs);
    t.setAttribute("stroke-width", sw);
  });
}

function applyViewBox() {
  const v = state.view;
  els.svg.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`);
  updateLabelSizes();
}
function resetView() {
  state.fullH = buildProjected(state.projection).height;
  state.view = { x: 0, y: 0, w: W, h: state.fullH };
  applyViewBox();
  updateAspect();
}

// Always fit the whole map (meet) so nothing is cropped — New Zealand sits at
// the far-east edge and "slice" was cutting it off. The SVG background is the
// sea colour, so the letterbox area just reads as more ocean (seamless).
function updateAspect() {
  if (!els.svg) return;
  els.svg.setAttribute("preserveAspectRatio", "xMidYMax meet");   // bottom-aligned
}

function setupZoomPan() {
  const svg = els.svg;
  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    const v = state.view;
    const r = svg.getBoundingClientRect();
    const mx = v.x + ((e.clientX - r.left) / r.width) * v.w;
    const my = v.y + ((e.clientY - r.top) / r.height) * v.h;
    const k = e.deltaY < 0 ? 0.85 : 1 / 0.85;
    const nw = Math.max(W / 40, Math.min(W, v.w * k));
    const nh = nw * (state.fullH / W);
    v.x = mx - (mx - v.x) * (nw / v.w);
    v.y = my - (my - v.y) * (nh / v.h);
    v.w = nw; v.h = nh;
    clampView(); applyViewBox();
  }, { passive: false });

  let drag = null;
  svg.addEventListener("mousedown", (e) => { drag = { x: e.clientX, y: e.clientY, vx: state.view.x, vy: state.view.y }; state.moved = false; svg.classList.add("grabbing"); });
  window.addEventListener("mouseup", () => { drag = null; svg.classList.remove("grabbing"); });
  window.addEventListener("mousemove", (e) => {
    if (!drag) return;
    if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4) state.moved = true;
    const r = svg.getBoundingClientRect();
    state.view.x = drag.vx - ((e.clientX - drag.x) / r.width) * state.view.w;
    state.view.y = drag.vy - ((e.clientY - drag.y) / r.height) * state.view.h;
    clampView(); applyViewBox();
  });
}
function clampView() {
  const v = state.view;
  v.x = Math.max(0, Math.min(W - v.w, v.x));
  v.y = Math.max(0, Math.min(state.fullH - v.h, v.y));
}

// ---- tooltip ----------------------------------------------------------------
let hoveredCca3 = null;
function clearHover() {
  els.tooltip.style.display = "none";
  els.svg.querySelectorAll(".hover").forEach((p) => p.classList.remove("hover"));
  hoveredCca3 = null;
}
function setupTooltip() {
  const tip = els.tooltip, svg = els.svg;
  svg.addEventListener("mousemove", (e) => {
    const t = e.target;
    if (t.tagName === "path") {
      tip.style.display = "block";
      tip.style.left = e.clientX + 12 + "px";
      tip.style.top = e.clientY + 12 + "px";
      const cca3 = t.dataset.cca3;
      const name = (state.propsByCca3[cca3] && state.propsByCca3[cca3].name) || t.dataset.name;
      let body = `<strong>${name}</strong>`;
      if (!state.layers.length) body += `<br><span class="nd">no indicator selected</span>`;
      for (const L of state.layers) {
        const e = L.byId[cca3];
        body += `<br>${L.cat.label}: ` + (e ? `${e.formatted} <span class="rank">#${e.rank}</span>` : `<span class="nd">no data</span>`);
      }
      tip.innerHTML = body;
      if (t.dataset.cca3 !== hoveredCca3) {
        svg.querySelectorAll(".hover").forEach((p) => p.classList.remove("hover"));
        t.classList.add("hover");
        hoveredCca3 = t.dataset.cca3;
        // Raise the hovered country so its border isn't half-overdrawn by
        // neighbours drawn later (which made one side look thicker). Keep it
        // below the bubble group, and the selected country topmost.
        raiseCountry(t);
        if (state.selected && state.selected !== hoveredCca3) raiseSelected();
      }
    } else {
      clearHover();   // moved onto the ocean/background — drop the highlight
    }
  });
  svg.addEventListener("mouseleave", clearHover);
}

// ---- selection + detail panel ----------------------------------------------
function setupSelection() {
  els.svg.addEventListener("click", (e) => {
    if (state.moved) return;                 // it was a pan, not a click
    if (e.target.tagName !== "path") return; // clicked the ocean/background
    toggleCountry(e.target.dataset.cca3);
  });
}

function toggleCountry(cca3) {
  if (!cca3) return;
  if (state.selected === cca3) { deselect(); return; }  // click again to unselect
  state.selected = cca3;
  applySelection();
  openOrUpdatePanel();
}

function deselect() {
  state.selected = null;
  applySelection();
  if (state.panel) { const p = state.panel; state.panel = null; p.close(); }
}

// Toggle the .selected class and raise the chosen path so its border isn't
// overdrawn by neighbouring countries.
function applySelection() {
  const svg = els.svg;
  svg.querySelectorAll("path.selected").forEach((p) => p.classList.remove("selected"));
  svg.querySelector("path.sel-overlay")?.remove();
  if (!state.selected) return;
  const chosen = raiseSelected();
  if (!chosen) return;
  chosen.classList.add("selected");
  // Soft translucent red tint over the selected country (its choropleth colour
  // still shows through); sits just above the country fill, below bubbles/labels.
  const ov = document.createElementNS(SVG_NS, "path");
  ov.setAttribute("d", chosen.getAttribute("d"));
  ov.setAttribute("class", "sel-overlay");
  chosen.after(ov);
}

// Raise a country path above its neighbours but BELOW the bubble group, so the
// raised fill never paints over the bubbles.
function raiseCountry(el) {
  const svg = els.svg;
  // Stay below the overlay groups (bubbles + labels). Bubbles are added before
  // labels, so inserting before the first existing overlay keeps el under both.
  const anchor = svg.querySelector("g.bubbles") || svg.querySelector("g.labels");
  if (anchor) svg.insertBefore(el, anchor);
  else svg.appendChild(el);
}

// Move the selected country's path up so its full border is visible (not
// half-overdrawn by neighbours). Returns the path, if found.
function raiseSelected() {
  if (!state.selected) return null;
  const svg = els.svg;
  let chosen = null;
  svg.querySelectorAll("path").forEach((p) => { if (p.dataset.cca3 === state.selected) chosen = p; });
  if (chosen) {
    raiseCountry(chosen);
    const ov = svg.querySelector("path.sel-overlay");
    if (ov) chosen.after(ov);   // keep the tint glued just above the selected fill
  }
  return chosen;
}

// Write the body HTML into the .country-detail wrapper (so scoped styles keep
// matching), recreating the wrapper if it isn't there.
function setPanelBody(html) {
  let body = state.panel.content.querySelector(".country-detail");
  if (!body) {
    state.panel.content.innerHTML = `<div class="country-detail"></div>`;
    body = state.panel.content.querySelector(".country-detail");
  }
  body.innerHTML = html;
}

function openOrUpdatePanel() {
  const jp = window.jsPanel;
  const html = buildPanelHTML(state.selected);
  const title = panelTitle(state.selected);
  if (state.panel) {
    setPanelBody(html);
    state.panel.setHeaderTitle(title);
    return;
  }
  if (!jp) return;
  state.panel = jp.create({
    headerTitle: title,
    // Header-only theme (NOT "filled"): "filled" tints the content text to an
    // auto-contrast color (white on a dark theme), which would be invisible on
    // the white content background.
    theme: "#3182bd",
    borderRadius: "8px",
    panelSize: { width: 360, height: 580 },
    position: "right-top -20 85",   // 20px from the right edge, 85px from the top
    headerControls: "closeonly",
    content: `<div class="country-detail">${html}</div>`,
    callback: (p) => {
      // Toggle a collapsible section in place — just flip classes, no full rebuild.
      p.content.addEventListener("click", (e) => {
        const hdr = e.target.closest(".ind-sec-hdr");
        if (!hdr) return;
        const key = hdr.dataset.sec;
        const nowOpen = !state.panelSections.has(key);
        nowOpen ? state.panelSections.add(key) : state.panelSections.delete(key);
        hdr.classList.toggle("open", nowOpen);
        hdr.closest(".ind-sec").classList.toggle("open", nowOpen);
      });
    },
    onclosed: () => {                 // closing via the X also deselects
      state.panel = null;
      if (state.selected) { state.selected = null; applySelection(); }
    },
  });
}

// Re-render the open panel's content (e.g. after the indicator changes).
function refreshPanel() {
  if (state.panel && state.selected) {
    setPanelBody(buildPanelHTML(state.selected));
    state.panel.setHeaderTitle(panelTitle(state.selected));
  }
}

function panelTitle(cca3) {
  const m = state.propsByCca3[cca3] || {};
  return `${m.name || cca3}`;
}

function buildPanelHTML(cca3) {
  const m = state.propsByCca3[cca3] || {};
  const prof = state.profiles[cca3] || {};
  const esc = (s) => (s == null ? "" : String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])));

  // Header: the first three properties sit to the right of the flag, each shown
  // as the value (normal size) with the property name beneath it (small, grey).
  const headProps = [
    ["Official name", m.formal || m.name_long],
    ["Continent", m.continent],
    ["Subregion", m.subregion],
  ].filter(([, v]) => v)
   .map(([k, v]) => `<div class="hp"><div class="hp-val">${esc(v)}</div><div class="hp-name">${k}</div></div>`).join("");

  const metaRows = [
    ["Economy", m.economy],
    ["Income group", m.income_grp],
  ].filter(([, v]) => v)
   .map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join("");

  const isoVal = [m.cca3, m.iso2, m.iso_n3].filter(Boolean).join(" · ");

  // Indicators grouped by dataset/category; ANIA is excluded from the country
  // panel, and a group is omitted when the country has no data for any of it.
  const colHead = `<tr class="ind-head"><th>Indicator</th><th class="c-rank">Rank</th><th class="c-val">Value</th></tr>`;
  const rowOf = (c) => {
    const e = prof[c.id];
    const rank = e ? `#${e.rank}` : "";
    const here = state.activeIds.includes(c.id) ? ' class="cur"' : "";
    const lbl = c.datasetKey === "ania"
      ? c.label.replace(/^ANIA:\s*/, "").replace(/\s*\(composite\)$/, "")
      : c.label;
    let val;
    if (!e) {
      val = '<span class="nd">no data</span>';
    } else if (c.datasetKey === "ania") {
      // Show only the score; the parenthetical legend appears on hover.
      const m = e.formatted.match(/\(([^)]*)\)/);
      const desc = m ? m[1] : "";
      val = `<span class="ania-val" title="${esc(desc)}">${esc(String(e.value))}</span>`;
    } else {
      val = esc(e.formatted);
    }
    return `<tr${here}><th>${esc(lbl)}</th><td class="c-rank">${rank}</td><td class="c-val">${val}</td></tr>`;
  };
  // Collapsible sections. World Bank shows the country's indicators; ANIA always
  // shows the 4 composites (value or "no data").
  const sections = [];
  const wbItems = state.catalog.filter((c) => c.datasetKey === "worldbank" && prof[c.id]);
  if (wbItems.length) sections.push(["wb", "World Bank", wbItems]);
  const aniaItems = state.catalog.filter((c) => c.datasetKey === "ania" && c.slug.endsWith("composite") && prof[c.id]);
  if (aniaItems.length) sections.push(["ania", "ANIA", aniaItems]);

  const indSections = sections.map(([key, label, items]) => {
    const open = state.panelSections.has(key);
    return `<div class="ind-sec${open ? " open" : ""}">
      <button class="ind-sec-hdr${open ? " open" : ""}" data-sec="${key}">
        <span class="ind-sec-label">${label}</span><span class="ind-sec-count">${items.length}</span>
      </button>
      <table>${colHead}${items.map(rowOf).join("")}</table>
    </div>`;
  }).join("");

  const wiki = m.wikidata
    ? `<a class="wiki" href="https://www.wikidata.org/wiki/${esc(m.wikidata)}" target="_blank" rel="noopener">Wikidata ${esc(m.wikidata)} ↗</a>`
    : "";

  const isoBlock = isoVal ? `<div class="detail-iso"><div class="iso-val">${esc(isoVal)}</div><div class="iso-name">ISO Codes</div></div>` : "";
  const flag = m.iso2
    ? `<div class="detail-flag"><img src="images/flags/${m.iso2.toLowerCase()}.svg" alt="Flag of ${esc(m.name)}">${isoBlock}</div>`
    : "";

  return `
    <div class="detail-scroll">
      <div class="detail-head">${flag}<div class="detail-head-props">${headProps}</div></div>
      <section class="detail-meta"><table>${metaRows}</table></section>
      <section class="detail-ind">${indSections}</section>
    </div>
    <div class="detail-status">${wiki || '<span class="status-empty">—</span>'}</div>`;
}

// ---- data loading -----------------------------------------------------------
async function loadCatalogDoc(c) {
  if (!state.cache[c.id]) state.cache[c.id] = await getJSON(`${c.base}/${c.slug}.json`);
  return state.cache[c.id];
}

// Load every indicator file (both datasets) once and build
// cca3 -> { catalogId -> entry } for the detail panel.
async function loadProfiles() {
  const docs = await Promise.all(state.catalog.map(async (c) => [c.id, await loadCatalogDoc(c)]));
  state.profiles = {};
  state.aniaCountries = new Set();
  const aniaIds = new Set(state.catalog.filter((c) => c.datasetKey === "ania").map((c) => c.id));
  for (const [id, doc] of docs) {
    for (const e of doc.entries) {
      (state.profiles[e.cca3] ||= {})[id] = e;
      if (aniaIds.has(id)) state.aniaCountries.add(e.cca3);
    }
  }
}

// ---- settings panel ---------------------------------------------------------
function buildSettingsHTML() {
  const scaleRadios = [["percentile", "Percentile"], ["linear", "Linear"]]
    .map(([k, l]) => `<label><input type="radio" name="set-scale" value="${k}" ${k === state.scale ? "checked" : ""}> ${l}</label>`).join("");
  return `<div class="settings-body">
    <fieldset><legend>Color scale</legend><div class="opt-col">${scaleRadios}</div></fieldset>
    <fieldset><legend>Map</legend><div class="opt-col">
      <label><input type="checkbox" id="set-title" ${state.titleVisible ? "checked" : ""}> Show map title</label>
      <label><input type="checkbox" id="set-labels" ${state.labelsVisible ? "checked" : ""}> Show country labels</label>
    </div></fieldset>
    <fieldset><legend>Panels</legend><div class="opt-col">
      <label><input type="checkbox" id="set-indicators" ${state.indicatorsVisible ? "checked" : ""}> Show indicators</label>
      <label><input type="checkbox" id="set-projections" ${state.projectionsVisible ? "checked" : ""}> Show projections</label>
      <label><input type="checkbox" id="set-legend" ${state.legendVisible ? "checked" : ""}> Show legend</label>
    </div></fieldset>
  </div>`;
}

function wireSettings(content) {
  content.addEventListener("change", (e) => {
    if (e.target.name === "set-scale") { state.scale = e.target.value; renderMap(); }
    else if (e.target.id === "set-title") { state.titleVisible = e.target.checked; updateMapTitle(); }
    else if (e.target.id === "set-labels") { state.labelsVisible = e.target.checked; renderMap(); }
    else if (e.target.id === "set-legend") { setLegendVisible(e.target.checked); }
    else if (e.target.id === "set-indicators") { setIndicatorsVisible(e.target.checked); }
    else if (e.target.id === "set-projections") { setProjectionsVisible(e.target.checked); }
  });
}

// Keep the settings checkboxes in sync when their panels are closed via the X.
function syncSettingsLegendToggle() {
  const cb = state.settingsPanel?.content.querySelector("#set-legend");
  if (cb) cb.checked = state.legendVisible;
}
function syncSettingsIndicatorsToggle() {
  const cb = state.settingsPanel?.content.querySelector("#set-indicators");
  if (cb) cb.checked = state.indicatorsVisible;
}
function syncSettingsProjectionsToggle() {
  const cb = state.settingsPanel?.content.querySelector("#set-projections");
  if (cb) cb.checked = state.projectionsVisible;
}

function closeSettings() {
  if (state.settingsPanel) { const p = state.settingsPanel; state.settingsPanel = null; p.close(); }
}

function toggleSettings() {
  if (state.settingsPanel) { closeSettings(); return; }
  const jp = window.jsPanel;
  if (!jp) return;
  state.settingsPanel = jp.create({
    headerTitle: "Settings",
    theme: "#3182bd",
    borderRadius: "8px",
    panelSize: { width: 280, height: "auto" },
    position: "left-bottom 64 -16",
    headerControls: "closeonly",
    content: `<div class="settings-wrap">${buildSettingsHTML()}</div>`,
    callback: (p) => wireSettings(p.content),
    onclosed: () => { state.settingsPanel = null; },
  });
}

function setupTheme() {
  if (localStorage.getItem("aigeo-theme") === "dark") document.body.classList.add("dark");
  els.themeBtn.addEventListener("click", () => {
    const dark = document.body.classList.toggle("dark");
    localStorage.setItem("aigeo-theme", dark ? "dark" : "light");
  });
}

async function main() {
  ["svg", "tooltip", "status", "gearBtn", "themeBtn", "mapTitle"].forEach((id) => (els[id] = document.getElementById(id)));
  els.gearBtn.addEventListener("click", toggleSettings);
  window.addEventListener("resize", () => { updateAspect(); positionLegend(); });
  // Click outside the Settings panel closes it (the gear handles its own toggle).
  document.addEventListener("mousedown", (e) => {
    if (!state.settingsPanel) return;
    if (state.settingsPanel.contains(e.target) || els.gearBtn.contains(e.target)) return;
    closeSettings();
  });
  setupTheme();
  try {
    const [geo, ...indexes] = await Promise.all([
      getJSON(GEO_URL),
      ...DATASETS.map((d) => getJSON(`${d.base}/index.json`)),
    ]);
    state.geo = geo;
    buildCatalog(indexes);
    for (const f of state.geo.features) state.propsByCca3[f.properties.cca3] = f.properties;
    resetView();   // initialize viewBox to the default projection's content size
    setupZoomPan();
    setupTooltip();
    setupSelection();
    await loadProfiles();   // all docs cached; selection is now synchronous
    const startId = (state.catalog.find((c) => c.id === "worldbank:gdp-per-capita") || state.catalog[0])?.id;
    state.activeIds = startId ? [startId] : [];
    renderMap();         // also shows the legend via syncLegend (if an indicator is selected)
    openIndicators();    // indicators list shown by default
  } catch (err) {
    els.status.textContent = "Load error: " + err.message +
      " — run ./serve.sh from the project root, then open http://localhost:3388/.";
    els.status.style.display = "block";
  }
}

main();

// Public surface for chat-map-bridge.js (Assistant Phase 5). Kept minimal: only
// what a chat tool call might need to mutate the map.
window.aigeo = {
  toggleCountry,
  selectIndicator,
  getSelected: () => state.selected,
  getActiveIndicatorIds: () => state.activeIds.slice(),
  isCountryInCatalog: (cca3) => Boolean(state.propsByCca3[cca3]),
  catalog: () => state.catalog.slice(),
};
