// colorscale.js — sequential choropleth color from a normalized value (MIT, this project)
// Intensity is driven by each country's value: darker = higher value.

// Light -> dark single-hue ramp (RGB stops). Missing data uses NO_DATA.
const RAMP = [
  [239, 243, 255],
  [198, 219, 239],
  [158, 202, 225],
  [107, 174, 214],
  [ 49, 130, 189],
  [  8,  81, 156],
  [  8,  48, 107],
];
export const NO_DATA = "#e6e6e6";

function lerp(a, b, t) { return a + (b - a) * t; }

// t in [0,1] -> "rgb(...)" interpolated across the ramp.
export function colorFor(t) {
  if (t == null || Number.isNaN(t)) return NO_DATA;
  t = Math.max(0, Math.min(1, t));
  const seg = t * (RAMP.length - 1);
  const i = Math.min(Math.floor(seg), RAMP.length - 2);
  const f = seg - i;
  const c0 = RAMP[i], c1 = RAMP[i + 1];
  return `rgb(${Math.round(lerp(c0[0], c1[0], f))},${Math.round(lerp(c0[1], c1[1], f))},${Math.round(lerp(c0[2], c1[2], f))})`;
}

// Build a normalizer value -> t in [0,1] for a set of numeric values.
// mode "linear":    t = (v - min) / (max - min)            (faithful magnitude)
// mode "percentile": t = rank position among values        (readable on skewed data)
export function makeNormalizer(values, mode) {
  const nums = values.filter((v) => typeof v === "number" && !Number.isNaN(v)).sort((a, b) => a - b);
  if (nums.length === 0) return () => null;
  const min = nums[0], max = nums[nums.length - 1];

  if (mode === "linear") {
    const span = max - min || 1;
    return (v) => (typeof v === "number" ? (v - min) / span : null);
  }
  // percentile: binary-search rank / (n-1)
  return (v) => {
    if (typeof v !== "number" || Number.isNaN(v)) return null;
    let lo = 0, hi = nums.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (nums[mid] < v) lo = mid + 1; else hi = mid; }
    return nums.length === 1 ? 1 : lo / (nums.length - 1);
  };
}
