// Synced Up Designs uniform sizing.
//
// CHART DATA IS VENDOR TRUTH -- transcribed 2026-07-16 from the two guides Rob linked,
// and verified digit-by-digit against each PDF's embedded text layer (not just read off
// a rendered image). A mistyped range here means a student gets an unwearable uniform
// and nobody finds out until August, so re-verify against the source before editing:
//   band  https://cdn.shopify.com/s/files/1/0333/9540/9031/files/Size_Guide_-_Classic_Top_Full_Length.pdf?v=1722619657
//   guard https://cdn.shopify.com/s/files/1/0333/9540/9031/files/Size_Guide_-_Unitard_Unisex.pdf?v=1722619651
//
// THE NON-OBVIOUS PART: only chest/waist/hip select a size. On both charts the neck/arm
// (and the unitard's inseam) columns are SINGLE values per size, not ranges -- they are
// the garment's dimensions, not selectors. Per the guides, sleeves and legs "come with
// extra length, to be hemmed to correct length for performer", so the measured neck/arm/
// inseam are hemming + fit-check numbers. They are carried here for display only and
// must never feed size selection.
//
// The same label means different bodies on the two charts (band M chest 39-41, guard M
// chest 32-34). Picking the wrong chart is a 2+ size error, not a rounding error.

export const BAND_CHART = {
  lane: "band",
  label: "Classic Top Full Length",
  guideUrl:
    "https://cdn.shopify.com/s/files/1/0333/9540/9031/files/Size_Guide_-_Classic_Top_Full_Length.pdf?v=1722619657",
  hasLengthClass: true,
  sizes: [
    { size: "3xS", chest: [31, 32], waist: [27, 28], hip: [29, 31], arm: 22.5, neck: 11.5 },
    { size: "2xS", chest: [32, 33], waist: [29, 30], hip: [32, 33.5], arm: 23, neck: 12 },
    { size: "XS", chest: [34, 35], waist: [31, 32], hip: [34, 35], arm: 23.5, neck: 12.5 },
    { size: "S", chest: [36, 38], waist: [33, 34], hip: [36, 38], arm: 24, neck: 13.5 },
    { size: "M", chest: [39, 41], waist: [35, 37], hip: [39, 40.5], arm: 24.5, neck: 14 },
    { size: "L", chest: [42, 44], waist: [38, 40], hip: [41, 43], arm: 25, neck: 14.5 },
    { size: "XL", chest: [45, 48], waist: [41, 44], hip: [44, 47], arm: 25.4, neck: 15.5 },
    { size: "2xL", chest: [49, 52], waist: [45, 48], hip: [48, 50], arm: 25.8, neck: 16 },
    { size: "3xL", chest: [53, 56], waist: [49, 52], hip: [51, 54], arm: 26, neck: 17 },
    { size: "4xL", chest: [57, 61], waist: [53, 56], hip: [55, 58], arm: 26, neck: 18 },
    { size: "5xL", chest: [61, 65], waist: [56, 60], hip: [58, 60], arm: 26, neck: 19 },
    { size: "6xL", chest: [65, 69], waist: [60, 64], hip: [61, 63], arm: 26, neck: 20 },
    { size: "7xL", chest: [69, 73], waist: [64, 68], hip: [64, 67], arm: 26, neck: 21 },
    { size: "8xL", chest: [73, 77], waist: [68, 72], hip: [68, 72], arm: 26, neck: 22 }
  ]
};

export const GUARD_CHART = {
  lane: "guard",
  label: "Unisex Unitard",
  guideUrl:
    "https://cdn.shopify.com/s/files/1/0333/9540/9031/files/Size_Guide_-_Unitard_Unisex.pdf?v=1722619651",
  hasLengthClass: false,
  sizes: [
    { size: "2XS", chest: [23, 25], waist: [21, 23], hip: [27, 29], inseam: 28, neck: 11.5, arm: 23 },
    { size: "XS", chest: [26, 28], waist: [24, 26], hip: [30, 32], inseam: 28, neck: 12, arm: 23 },
    { size: "S", chest: [29, 31], waist: [27, 29], hip: [33, 35], inseam: 28, neck: 12.5, arm: 23 },
    { size: "M", chest: [32, 34], waist: [30, 32], hip: [36, 38], inseam: 28, neck: 13, arm: 23 },
    { size: "L", chest: [35, 37], waist: [33, 36], hip: [39, 41], inseam: 28, neck: 13.5, arm: 23.5 },
    { size: "XL", chest: [38, 41], waist: [37, 39], hip: [42, 44], inseam: 28, neck: 14, arm: 23.5 },
    { size: "2XL", chest: [42, 44], waist: [40, 43], hip: [45, 48], inseam: 28, neck: 15.5, arm: 24 },
    { size: "3XL", chest: [45, 47], waist: [44, 47], hip: [49, 52], inseam: 28.5, neck: 16.5, arm: 24.5 },
    { size: "4XL", chest: [48, 51], waist: [48, 51], hip: [53, 56], inseam: 28.5, neck: 17.5, arm: 24.5 },
    { size: "5XL", chest: [52, 54], waist: [52, 54], hip: [57, 61], inseam: 29, neck: 18.5, arm: 25 },
    { size: "6XL", chest: [55, 58], waist: [55, 58], hip: [62, 65], inseam: 29, neck: 19.5, arm: 25 }
  ]
};

// Both guides escalate rather than guess once the measurements spread this far apart:
// "Anytime you have measurements that vary in size more than 3 sizes (Small-2XL),
// contact your Synced Up Sales Rep." Their own example (S->2XL) is a 4-step gap, so
// "more than 3" means a span strictly greater than 3 rungs on that chart's ladder.
export const WIDE_SPREAD_STEPS = 3;

const DRIVING_KEYS = ["chest", "waist", "hip"];

export function chartForRole(mbRole, instrument) {
  const hay = `${mbRole || ""} ${instrument || ""}`.toLowerCase();
  return hay.includes("guard") ? GUARD_CHART : BAND_CHART;
}

function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Which rung does one measurement land on?
// The vendor charts are not a clean partition: they overlap (band chest 61" is in both
// 4xL 57-61 and 5xL 61-65) and they gap (band hip 60.5" falls between 5xL 58-60 and
// 6xL 61-63). Both are resolved toward the LARGER size on purpose -- a uniform can be
// taken in, it cannot be let out.
export function rungFor(chart, key, value) {
  const v = num(value);
  if (v === null) return null;
  const hits = [];
  chart.sizes.forEach((s, i) => {
    const [lo, hi] = s[key];
    if (v >= lo && v <= hi) hits.push(i);
  });
  if (hits.length) return Math.max(...hits);

  let best = null;
  let bestDist = Infinity;
  chart.sizes.forEach((s, i) => {
    const [lo, hi] = s[key];
    const d = v < lo ? lo - v : v > hi ? v - hi : 0;
    if (d < bestDist || (d === bestDist && i > best)) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

// "5-9" -> 69. Height is free text on the form, so accept what humans actually type
// and return null rather than guess when it is unreadable.
export function parseHeightInches(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  const ft = s.match(/^(\d{1,2})\s*(?:'|’|-|ft|feet|\s)\s*(\d{1,2}(?:\.\d+)?)\s*(?:"|”|in|inches)?$/i);
  if (ft) {
    const inches = Number(ft[1]) * 12 + Number(ft[2]);
    return inches >= 36 && inches <= 96 ? inches : null;
  }
  const bare = s.match(/^(\d{2,3}(?:\.\d+)?)\s*(?:"|”|in|inches)?$/i);
  if (bare) {
    const n = Number(bare[1]);
    return n >= 36 && n <= 96 ? n : null;
  }
  const feetOnly = s.match(/^(\d)\s*(?:'|’|ft|feet)$/i);
  if (feetOnly) {
    const n = Number(feetOnly[1]) * 12;
    return n >= 36 && n <= 96 ? n : null;
  }
  return null;
}

// Band only. Rob's 2026 ordering rule uses no SHORT garments: everyone is REGULAR
// unless the recorded height is over 6'1", in which case they are TALL. A missing or
// unparseable height stays visibly flagged but falls back to REGULAR so the order form
// always has a usable length class.
export function lengthClassFor(heightRaw) {
  const inches = parseHeightInches(heightRaw);
  if (inches === null) return { lengthClass: "REGULAR", heightInches: null, unparsedHeight: Boolean(String(heightRaw || "").trim()) };
  if (inches <= 73) return { lengthClass: "REGULAR", heightInches: inches, unparsedHeight: false };
  return { lengthClass: "TALL", heightInches: inches, unparsedHeight: false };
}

// The recommendation follows Rob's 2026-08-07 order rule: use the LARGEST size selected
// by chest, waist, or hip. The minimum ordered size defaults to Small; callers may pass
// XS for the one approved exception (Hyeyul Um). A uniform can be taken in, but cannot
// be let out, so neither averaging nor rounding down is appropriate for this order.
export function computeSize(measurement, { mbRole, instrument, minimumSize = "S" } = {}) {
  const chart = chartForRole(mbRole, instrument);
  const per = {};
  const rungs = [];
  for (const key of DRIVING_KEYS) {
    const col = key === "hip" ? "hips_in" : `${key}_in`;
    const r = rungFor(chart, key, measurement?.[col]);
    if (r === null) {
      per[key] = null;
      continue;
    }
    per[key] = chart.sizes[r].size;
    rungs.push(r);
  }

  const base = {
    lane: chart.lane,
    chartLabel: chart.label,
    guideUrl: chart.guideUrl,
    per,
    measuredCount: rungs.length,
    partial: rungs.length > 0 && rungs.length < DRIVING_KEYS.length,
    ...(chart.hasLengthClass ? lengthClassFor(measurement?.height) : { lengthClass: null, heightInches: null, unparsedHeight: false })
  };

  const minimumIndex = Math.max(0, chart.sizes.findIndex((s) => s.size === minimumSize));
  const orderableSizes = chart.sizes.slice(minimumIndex).map((s) => s.size);

  if (!rungs.length) {
    return { ...base, size: null, sizeIndex: null, spread: null, wideSpread: false, sizes: orderableSizes };
  }

  const idx = Math.max(minimumIndex, ...rungs);
  const spread = Math.max(...rungs) - Math.min(...rungs);
  const picked = chart.sizes[idx];

  return {
    ...base,
    size: picked.size,
    sizeIndex: idx,
    spread,
    wideSpread: spread > WIDE_SPREAD_STEPS,
    garment: { neck: picked.neck ?? null, arm: picked.arm ?? null, inseam: picked.inseam ?? null },
    sizes: orderableSizes
  };
}
