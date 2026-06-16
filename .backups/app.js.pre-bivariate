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
  indicator: null,     // currently loaded indicator file (full JSON)
  activeId: null,      // catalog id of the active indicator
  cache: {},           // catalog id -> loaded JSON
  projection: "equirectangular",
  scale: "percentile",
  byCca3: {},          // cca3 -> entry, for current indicator
  view: { x: 0, y: 0, w: W, h: W }, // viewBox (zoom/pan); h reset per projection
  fullH: W,            // unzoomed viewBox height for the current projection
  propsByCca3: {},     // cca3 -> geometry properties (name, region, iso2, …)
  profiles: {},        // cca3 -> { indicator -> {value, formatted, rank} }
  selected: null,      // cca3 of selected country, or null
  panel: null,         // country-detail jsPanel instance, or null
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
  projCache[key] = { features, height };
  return projCache[key];
}

// ---- rendering --------------------------------------------------------------
function renderMap() {
  const { features } = buildProjected(state.projection);
  const values = state.indicator.entries.map((e) => e.value);
  const normalize = makeNormalizer(values, state.scale);
  const svg = els.svg;
  svg.innerHTML = "";
  for (const f of features) {
    const entry = state.byCca3[f.cca3];
    const t = entry ? normalize(entry.value) : null;
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", f.d);
    path.setAttribute("fill", entry ? colorFor(t) : NO_DATA);
    path.setAttribute("class", "country");
    path.dataset.cca3 = f.cca3;
    path.dataset.name = entry ? entry.name : f.name;
    path.dataset.value = entry ? entry.formatted : "no data";
    path.dataset.rank = entry ? `#${entry.rank}` : "";
    svg.appendChild(path);
  }
  applyViewBox();
  applySelection();   // re-highlight selected country after a fresh render
  refreshPanel();     // keep panel content in sync with the current indicator
  updateLegend();     // keep the legend panel in sync with the current indicator
  updateIndicators(); // highlight the active indicator in the indicators list
  updateProjections();// highlight the active projection in the projections list
}

// ---- legend panel -----------------------------------------------------------
function buildLegendHTML() {
  if (!state.indicator) return "";
  const values = state.indicator.entries.map((e) => e.value);
  const nums = values.filter((v) => typeof v === "number").sort((a, b) => a - b);
  if (!nums.length) return "";
  const fmtOf = (target) => {
    let best = state.indicator.entries[0], bd = Infinity;
    for (const e of state.indicator.entries) {
      const d = Math.abs(e.value - target); if (d < bd) { bd = d; best = e; }
    }
    return best.formatted;
  };
  const min = nums[0], max = nums[nums.length - 1], mid = nums[Math.floor(nums.length / 2)];
  const stops = [];
  for (let i = 0; i <= 6; i++) stops.push(colorFor(i / 6));
  const label = activeLabel();
  return `<div class="legend-body">
    <div class="legend-title">${label}</div>
    <div class="legend-bar" style="background:linear-gradient(to right,${stops.join(",")})"></div>
    <div class="legend-labels"><span>${fmtOf(min)}</span><span>${fmtOf(mid)} (median)</span><span>${fmtOf(max)}</span></div>
    <div class="legend-note">Color intensity = country value (${state.scale} scale). Grey = no data.</div>
  </div>`;
}

// Catalog helpers.
function catEntry(id) { return state.catalog.find((c) => c.id === id); }
function activeLabel() { const c = catEntry(state.activeId); return c ? c.label : (state.activeId || ""); }

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

function updateLegend() {
  if (!state.legendPanel) return;
  state.legendPanel.content.innerHTML = buildLegendHTML();
  positionLegend();   // width can change with the indicator; keep it in-window
}

function openLegend() {
  const jp = window.jsPanel;
  state.legendVisible = true;
  syncSettingsLegendToggle();
  if (state.legendPanel || !jp) { updateLegend(); return; }
  state.legendPanel = jp.create({
    headerTitle: "Legend",
    theme: "#3182bd",
    borderRadius: "8px",
    panelSize: { width: "auto", height: "auto" },
    position: "right-bottom -16 -16",
    headerControls: "closeonly",
    content: buildLegendHTML(),
    callback: () => requestAnimationFrame(positionLegend),  // place once content is measured
    onclosed: () => {                 // closing via the X hides the legend
      state.legendPanel = null;
      state.legendVisible = false;
      syncSettingsLegendToggle();
    },
  });
}

function closeLegend() {
  state.legendVisible = false;
  if (state.legendPanel) { const p = state.legendPanel; state.legendPanel = null; p.close(); }
  syncSettingsLegendToggle();
}

function setLegendVisible(show) { show ? openLegend() : closeLegend(); }

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
    const items = g.items.map((c) =>
      `<button class="ind-item${c.id === state.activeId ? " active" : ""}" data-id="${c.id}">
         <span class="ind-left">${indicatorIcon(c.iconKey)}<span class="ind-name">${c.label}</span></span>
         <span class="ind-count">${c.count}</span>
       </button>`).join("");
    return `<div class="ind-group">
      <button class="ind-group-hdr${open ? " open" : ""}" data-group="${g.key}">
        <span class="ind-caret">▸</span><span class="ind-group-label">${g.label}</span><span class="ind-group-count">${g.items.length}</span>
      </button>
      <div class="ind-group-body"${open ? "" : " hidden"}>${items}</div>
    </div>`;
  }).join("");
  return `<div class="indicator-list">${groups}</div>`;
}

function refreshIndicatorsPanel() {
  if (state.indicatorsPanel) state.indicatorsPanel.content.innerHTML = buildIndicatorsHTML();
}

function updateIndicators() {
  if (!state.indicatorsPanel) return;
  state.indicatorsPanel.content.querySelectorAll(".ind-item").forEach((b) => {
    b.classList.toggle("active", b.dataset.id === state.activeId);
  });
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
    panelSize: { width: 310, height: 520 },
    position: "left-top 16 85",
    headerControls: "closeonly",
    content: buildIndicatorsHTML(),
    callback: (p) => {
      p.content.addEventListener("click", (e) => {
        const hdr = e.target.closest(".ind-group-hdr");
        if (hdr) {
          const key = hdr.dataset.group;
          state.openGroups.has(key) ? state.openGroups.delete(key) : state.openGroups.add(key);
          refreshIndicatorsPanel();
          return;
        }
        const btn = e.target.closest(".ind-item");
        if (btn) loadIndicator(btn.dataset.id);
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
function applyViewBox() {
  const v = state.view;
  els.svg.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`);
}
function resetView() {
  state.fullH = buildProjected(state.projection).height;
  state.view = { x: 0, y: 0, w: W, h: state.fullH };
  applyViewBox();
  updateAspect();
}

// Choose meet/slice per projection + window so the map never letterboxes
// top/bottom: if the map is wider than the window, fill height and crop the
// sides (slice); otherwise show it fully with any gap on the sides (meet).
function updateAspect() {
  if (!els.svg || !state.fullH) return;
  const mapAspect = W / state.fullH;
  const winAspect = window.innerWidth / window.innerHeight;
  const par = mapAspect > winAspect ? "xMidYMid slice" : "xMidYMid meet";
  els.svg.setAttribute("preserveAspectRatio", par);
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
      tip.innerHTML = `<strong>${t.dataset.name}</strong><br>${t.dataset.value}` +
        (t.dataset.rank ? ` <span class="rank">${t.dataset.rank}</span>` : "");
      if (t.dataset.cca3 !== hoveredCca3) {
        svg.querySelectorAll(".hover").forEach((p) => p.classList.remove("hover"));
        t.classList.add("hover");
        hoveredCca3 = t.dataset.cca3;
        // Raise the hovered country so its border isn't half-overdrawn by
        // neighbours drawn later (which made one side look thicker). Keep the
        // selected country topmost.
        svg.appendChild(t);
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
  if (!state.selected) return;
  const chosen = raiseSelected();
  if (chosen) chosen.classList.add("selected");
}

// Move the selected country's path to the top of the SVG so its full border
// is visible (not half-overdrawn by neighbours). Returns the path, if found.
function raiseSelected() {
  if (!state.selected) return null;
  const svg = els.svg;
  let chosen = null;
  svg.querySelectorAll("path").forEach((p) => { if (p.dataset.cca3 === state.selected) chosen = p; });
  if (chosen) svg.appendChild(chosen);
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
    panelSize: { width: 360, height: 530 },
    position: "right-top -20 85",   // 20px from the right edge, 85px from the top
    headerControls: "closeonly",
    content: `<div class="country-detail">${html}</div>`,
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

  const metaRows = [
    ["Official name", m.formal || m.name_long],
    ["Continent", m.continent],
    ["Subregion", m.subregion],
    ["World Bank region", m.region_wb],
    ["Economy", m.economy],
    ["Income group", m.income_grp],
    ["ISO codes", [m.cca3, m.iso2, m.iso_n3].filter(Boolean).join(" · ")],
  ].filter(([, v]) => v)
   .map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join("");

  // Indicators grouped by dataset/category; ANIA is excluded from the country
  // panel, and a group is omitted when the country has no data for any of it.
  const indRows = state.groups
    .filter((g) => g.items[0]?.datasetKey === "worldbank" && g.items.some((c) => prof[c.id]))
    .map((g) => {
      const head = `<tr class="grp"><th colspan="2">${esc(g.label)}</th></tr>`;
      const rows = g.items.map((c) => {
        const e = prof[c.id];
        const val = e ? esc(e.formatted) : '<span class="nd">no data</span>';
        const rank = e ? `<span class="rank">#${e.rank}</span>` : "";
        const here = c.id === state.activeId ? ' class="cur"' : "";
        return `<tr${here}><th>${esc(c.label)}</th><td>${val} ${rank}</td></tr>`;
      }).join("");
      return head + rows;
    }).join("");

  const wiki = m.wikidata
    ? `<a class="wiki" href="https://www.wikidata.org/wiki/${esc(m.wikidata)}" target="_blank" rel="noopener">Wikidata ${esc(m.wikidata)} ↗</a>`
    : "";

  const flag = m.iso2
    ? `<div class="detail-flag"><img src="images/countries/${m.iso2.toLowerCase()}.svg" alt="Flag of ${esc(m.name)}"></div>`
    : "";

  return `
    ${flag}
    <section class="detail-meta"><table>${metaRows}</table></section>
    <h4>Indicators</h4>
    <section class="detail-ind"><table>${indRows}</table></section>
    ${wiki}`;
}

// ---- data loading -----------------------------------------------------------
async function loadCatalogDoc(c) {
  if (!state.cache[c.id]) state.cache[c.id] = await getJSON(`${c.base}/${c.slug}.json`);
  return state.cache[c.id];
}

async function loadIndicator(id) {
  const c = catEntry(id);
  if (!c) return;
  state.indicator = await loadCatalogDoc(c);
  state.activeId = id;
  state.byCca3 = {};
  for (const e of state.indicator.entries) state.byCca3[e.cca3] = e;
  renderMap();
}

// Load every indicator file (both datasets) once and build
// cca3 -> { catalogId -> entry } for the detail panel.
async function loadProfiles() {
  const docs = await Promise.all(state.catalog.map(async (c) => [c.id, await loadCatalogDoc(c)]));
  state.profiles = {};
  for (const [id, doc] of docs) {
    for (const e of doc.entries) (state.profiles[e.cca3] ||= {})[id] = e;
  }
}

// ---- settings panel ---------------------------------------------------------
function buildSettingsHTML() {
  const scaleRadios = [["percentile", "Percentile"], ["linear", "Linear"]]
    .map(([k, l]) => `<label><input type="radio" name="set-scale" value="${k}" ${k === state.scale ? "checked" : ""}> ${l}</label>`).join("");
  return `<div class="settings-body">
    <fieldset><legend>Color scale</legend><div class="opt-col">${scaleRadios}</div></fieldset>
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
  ["svg", "tooltip", "status", "gearBtn", "themeBtn"].forEach((id) => (els[id] = document.getElementById(id)));
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
    await loadProfiles();
    await loadIndicator(state.catalog[0].id);
    openIndicators();    // indicators list shown by default
    openLegend();        // legend shown by default
  } catch (err) {
    els.status.textContent = "Load error: " + err.message +
      " — run ./serve.sh from the project root, then open http://localhost:3388/.";
    els.status.style.display = "block";
  }
}

main();
