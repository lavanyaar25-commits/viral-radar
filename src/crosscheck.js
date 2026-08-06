// CROSS-PLATFORM CONFIRMATION
//
// A spike on one platform is often noise - a bot wave, one big account, a bug.
// The same thing rising on Spotify AND YouTube AND Google Search at the same
// time is a real cultural moment. Those last weeks, not hours.
//
// This is the feature nobody else sells, because doing it needs all four feeds
// pulled at the same moment - which is exactly what our pipeline does.

export function addConfirmation(scored) {
  // Build a searchable bag of words per source.
  const bySource = new Map();
  for (const r of scored) {
    if (!bySource.has(r.source)) bySource.set(r.source, []);
    bySource.get(r.source).push(normalize(r.entity));
  }

  const allSources = [...bySource.keys()];

  return scored.map((r) => {
    const me = normalize(r.entity);
    const tokens = significantTokens(me);
    const confirmedOn = [];

    for (const src of allSources) {
      if (src === r.source) continue;
      const hit = bySource.get(src).some((other) => overlaps(tokens, other));
      if (hit) confirmedOn.push(src);
    }

    const platforms = confirmedOn.length + 1;
    return {
      ...r,
      confirmedOn,
      platforms,
      // Confirmation multiplies confidence, it does not create it.
      confidence: +Math.min(1, 0.35 + 0.22 * confirmedOn.length).toFixed(2),
      // finalScore is the NORMALISED score lifted by cross-platform confirmation,
      // then capped at 100 so it stays readable as a 0-100 reading.
      finalScore: +Math.min(100, (r.norm ?? r.velocity) * (1 + 0.12 * confirmedOn.length)).toFixed(1),
    };
  });
}

const STOP = new Set([
  'the','a','an','of','and','or','to','in','on','for','with','feat','ft','official',
  'video','music','remix','version','live','new','my','me','you','is','it','how','what',
]);

const normalize = (s) =>
  String(s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

function significantTokens(s) {
  return s.split(' ').filter((w) => w.length > 3 && !STOP.has(w));
}

// Two entities match if they share at least 2 meaningful words, or 1 long
// distinctive word (like an artist name or product name).
function overlaps(tokens, other) {
  if (!tokens.length) return false;
  const hits = tokens.filter((t) => other.includes(t));
  return hits.length >= 2 || hits.some((t) => t.length >= 7);
}
