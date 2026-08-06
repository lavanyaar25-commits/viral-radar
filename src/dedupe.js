// AGGREGATION
//
// Google Trends and YouTube are pulled per country. The same term shows up in
// several of them. Left alone, your top 10 becomes eight copies of one thing.
//
// So we merge them into one record - and treat "trending in 5 countries at once"
// as a much stronger signal than "trending in 1". That geographic spread is a
// second, independent confirmation signal on top of cross-platform.

export function aggregate(records) {
  const merged = new Map();

  for (const r of records) {
    const k = `${r.source}::${r.entity.toLowerCase()}`;
    const seen = merged.get(k);

    if (!seen) {
      merged.set(k, { ...r, geos: [r.geo || r.region].filter(Boolean), bestPos: r.pos });
      continue;
    }

    // Same thing, different country: add up the volume, keep the best rank.
    seen.volume += r.volume || 0;
    seen.bestPos = Math.min(seen.bestPos, r.pos);
    seen.pos = seen.bestPos;
    const g = r.geo || r.region;
    if (g && !seen.geos.includes(g)) seen.geos.push(g);
    if (!seen.headline && r.headline) seen.headline = r.headline;
  }

  // Countries it is trending in becomes a real multiplier on the score.
  return [...merged.values()].map((r) => ({
    ...r,
    geoCount: r.geos.length || 1,
    geoBoost: 1 + 0.18 * Math.max(0, (r.geos.length || 1) - 1),
  }));
}

// Stop one loud source from filling the whole brief. Take the best N from each,
// then fill the rest by score. Your customer wants a spread, not 20 rows of
// Google Trends noise.
export function diversify(sorted, perSourceCap = 6, limit = 25) {
  // Split into one queue per source, each already in score order.
  const queues = new Map();
  for (const r of sorted) {
    if (!queues.has(r.source)) queues.set(r.source, []);
    queues.get(r.source).push(r);
  }

  // Then take turns: best remaining item from each source, round after round.
  // A source that has run out simply stops contributing, so a quiet day on one
  // feed does not leave gaps - the others fill in.
  const out = [];
  for (let round = 0; round < perSourceCap && out.length < limit; round++) {
    const thisRound = [];
    for (const q of queues.values()) {
      if (q.length) thisRound.push(q.shift());
    }
    // Within a round, still show the strongest first.
    thisRound.sort((a, b) => b.finalScore - a.finalScore);
    out.push(...thisRound);
  }
  return out.slice(0, limit);
}
