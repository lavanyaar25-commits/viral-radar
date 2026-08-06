// NORMALISATION - the fix that makes the whole thing actually usable.
//
// The problem: a raw velocity of 5 is enormous for Spotify (where most songs
// barely move) and tiny for Google Trends (where everything churns daily).
// Comparing them directly means one source drowns out the other three.
//
// The fix: score every item against its OWN source's normal behaviour.
// "How unusual is this, for Spotify?" is the right question, not
// "is this number bigger than that number?"
//
// We use median and MAD (median absolute deviation) instead of mean and
// standard deviation, because one viral outlier would wreck a mean.

export function normalizeBySource(scored) {
  const groups = new Map();
  for (const r of scored) {
    if (!groups.has(r.source)) groups.set(r.source, []);
    groups.get(r.source).push(r.velocity);
  }

  const stats = new Map();
  for (const [source, values] of groups) {
    const med = median(values);
    // Floor the spread. Without this, a source where everything clusters
    // tightly produces a near-zero divisor, every item's z-score explodes,
    // and the whole source pins at 100 with no ranking left inside it.
    const rawMad = median(values.map((v) => Math.abs(v - med))) * 1.4826;
    const mad = Math.max(rawMad, Math.abs(med) * 0.15, 0.5);
    stats.set(source, { med, mad, sorted: [...values].sort((a, b) => a - b) });
  }

  return scored.map((r) => {
    const { med, mad, sorted } = stats.get(r.source);

    // Part A: how unusual is this, in "normal steps" above typical?
    const z = clamp((r.velocity - med) / mad, -8, 8);
    const zPart = 100 / (1 + Math.exp(-z / 3));

    // Part B: where does it sit in the pack? Guarantees a clean ordering even
    // when every item in a source is unusual on the same day.
    const pctPart = (rankOf(sorted, r.velocity) / Math.max(sorted.length - 1, 1)) * 100;

    const norm = +(0.7 * zPart + 0.3 * pctPart).toFixed(1);
    return { ...r, z: +z.toFixed(2), norm };
  });
}

// Now classify on the normalised number, which means the same thresholds
// work for every source.
export function classifyNorm(norm, ageDays) {
  if (norm >= 80 && ageDays <= 7) return 'IGNITION';
  if (norm >= 68) return 'CLIMBING';
  if (norm >= 45) return 'PLATEAU';
  return 'DECAYING';
}

// Index of the last value <= v, i.e. how many items this one beats.
function rankOf(sorted, v) {
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const m = (lo + hi) >> 1; sorted[m] <= v ? (lo = m + 1) : (hi = m); }
  return Math.max(0, lo - 1);
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

function median(arr) {
  const a = [...arr].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
