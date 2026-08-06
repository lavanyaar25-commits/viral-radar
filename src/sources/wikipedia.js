// TIER 3 SOURCE - Wikipedia pageviews, in seven languages.
//
// This is the confirmation layer, and it is the most honest signal in the stack.
//
// Social chatter can be bots. News coverage can be one wire story syndicated
// 400 times. But a million people individually deciding to go and look something
// up on Wikipedia cannot be faked. If a story is real and genuinely global,
// its Wikipedia page spikes. If it does not spike, the story was media noise.
//
// The catch: Wikipedia publishes this once a day, not live. So it never tells
// you something first - it tells you whether what you saw first was real.
// We use it to raise confidence, never to raise urgency.
//
// Official Wikimedia API. Free, no key, no rate limit worth worrying about.

import { get } from '../lib/http.js';

// Latin-script wikis, so proper nouns (SpaceX, Ebola, Infantino) stay spelled
// the same and can be matched against news headlines without translation.
const WIKIS = ['en', 'es', 'pt', 'de', 'fr', 'it', 'id'];

// Housekeeping pages that are always at the top and mean nothing.
const JUNK = /^(Main_Page|Wikipedia:|Special:|Portal:|Portada|Hauptseite|Pagina_principale|Halaman_Utama|Accueil|Página_principal|-)/i;

export async function fetchWikipedia() {
  const [d1, d2] = [dayPath(1), dayPath(2)]; // yesterday, and the day before

  const out = [];
  for (const wiki of WIKIS) {
    const [today, prev] = await Promise.all([
      topFor(wiki, d1),
      topFor(wiki, d2),
    ]);
    if (!today.size) continue;

    const prevViews = prev;
    let rank = 0;
    for (const [article, views] of today) {
      rank++;
      if (rank > 60) break;

      const before = prevViews.get(article) || 0;
      // A page that did not exist in yesterday's top list is a genuine new
      // arrival - treat its previous value as a small number, not zero, so the
      // percentage change stays sane.
      const baseline = before || Math.max(views * 0.15, 1000);

      out.push({
        source: 'wikipedia',
        kind: 'lookup',
        tier: 3,
        wiki,
        entity: article.replace(/_/g, ' '),
        pos: rank,
        volume: views,
        volumeDelta: views - baseline,
        isNew: !before,
        ageHours: 24,           // daily data, so treat everything as a day old
        url: `https://${wiki}.wikipedia.org/wiki/${encodeURIComponent(article)}`,
      });
    }
  }
  return out;
}

async function topFor(wiki, dpath) {
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/${wiki}.wikipedia/all-access/${dpath}`;
  try {
    const data = await get(url, { as: 'json', retries: 2 });
    const arts = data?.items?.[0]?.articles || [];
    return new Map(
      arts.filter((a) => !JUNK.test(a.article)).map((a) => [a.article, a.views])
    );
  } catch {
    return new Map();
  }
}

// Wikipedia publishes with a lag, so "yesterday" is the freshest complete day.
function dayPath(daysAgo) {
  const d = new Date(Date.now() - daysAgo * 864e5);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())}`;
}
