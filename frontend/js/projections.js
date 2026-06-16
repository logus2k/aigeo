// projections.js — dependency-free geographic projections (MIT, this project)
// Each projection maps [lon, lat] (degrees) -> [x, y] in an arbitrary unit space.
// The renderer fits the projected extent to the viewport, so absolute scale/sign
// only needs to be internally consistent. y grows downward after fitting.

const DEG = Math.PI / 180;

// Equirectangular (Plate Carrée): trivial lon/lat -> x/y.
function equirectangular(lon, lat) {
  return [lon, -lat];
}

// Web Mercator: conformal; latitude clamped to avoid infinity at the poles.
function mercator(lon, lat) {
  const max = 85.05112878;
  const phi = Math.max(-max, Math.min(max, lat)) * DEG;
  const y = Math.log(Math.tan(Math.PI / 4 + phi / 2));
  return [lon * DEG, -y];
}

// Robinson: pseudocylindrical, table-driven (Snyder/PROJ coefficients).
// Tables are sampled every 5 degrees of latitude, linearly interpolated.
const ROBINSON_PLEN = [ // length of parallel relative to equator
  1.0000, 0.9986, 0.9954, 0.9900, 0.9822, 0.9730, 0.9600, 0.9427, 0.9216,
  0.8962, 0.8679, 0.8350, 0.7986, 0.7597, 0.7186, 0.6732, 0.6213, 0.5722, 0.5322,
];
const ROBINSON_PDFE = [ // distance of parallel from equator
  0.0000, 0.0620, 0.1240, 0.1860, 0.2480, 0.3100, 0.3720, 0.4340, 0.4958,
  0.5571, 0.6176, 0.6769, 0.7346, 0.7903, 0.8435, 0.8936, 0.9394, 0.9761, 1.0000,
];

function robinson(lon, lat) {
  const alat = Math.abs(lat);
  const i = Math.min(Math.floor(alat / 5), 17);
  const f = (alat - i * 5) / 5; // fraction within the 5-degree band
  const plen = ROBINSON_PLEN[i] + (ROBINSON_PLEN[i + 1] - ROBINSON_PLEN[i]) * f;
  const pdfe = ROBINSON_PDFE[i] + (ROBINSON_PDFE[i + 1] - ROBINSON_PDFE[i]) * f;
  const x = 0.8487 * plen * (lon * DEG);
  const y = 1.3523 * pdfe * (lat < 0 ? -1 : 1);
  return [x, -y];
}

export const PROJECTIONS = {
  equirectangular: { label: "Equirectangular", project: equirectangular },
  robinson: { label: "Robinson", project: robinson },
  mercator: { label: "Mercator", project: mercator },
};
