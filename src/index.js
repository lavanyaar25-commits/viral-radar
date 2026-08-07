// THE PIPELINE
//
// Runs top to bottom, every 3 hours, on its own:
//   collect -> cluster -> compare to history -> score -> confirm -> explain -> publish
//
// Ordered by how early each source sees a story:
//   Tier 1  Bluesky, Google News  - minutes to 1 hour
//   Tier 2  Google Trends, Reddit - 1 to 6 hours
//   Tier 3  Wikipedia             - next day (confirmation only)

import { fetchBluesky } from './sources/bluesky.js';
import { fetchGoogleNews } from './sources/googlenews.js';
import { fetchGoogleTrends } from './sources/gtrends.js';
import { fetchReddit } from './sources/reddit.js';
import { fetchWikipedia } from './sources/wikipedia.js';
import { clusterNews } from './cluster.js';
import { saveSnapshot, loadPrevious, indexSnapshot } from './store.js';
import { scoreAll } from './score.js';
import { normalizeBySource, classifyNorm } from './normalize.js';
import { addConfirmation } from './crosscheck.js';
import { aggregate, diversify } from './dedupe.js';
import { enrich } from './enrich.js';
import { publish } from './publish.js';
import { sendAlerts } from './alert.js';

const t0 = Date.now();
const log = (...a) => console.log(...a);

// ---- 1. COLLECT ------------------------------------------------------------
log('1/7  collecting…');
const results = await Promise.allSettled([
  fetchBluesky(),
  fetchGoogleNews(),
  fetchGoogleTrends(),
  fetchReddit({
    clientId: process.env.REDDIT_CLIENT_ID,
    clientSecret: process.env.REDDIT_CLIENT_SECRET,
  }),
  fetchWikipedia(),
]);

const names = ['bluesky', 'googlenews', 'gtrends', 'reddit', 'wikipedia'];
const bucket = {};
results.forEach((r, i) => {
  if (r.status === 'fulfilled') {
    bucket[names[i]] = r.value;
    log(`     ${names[i].padEnd(12)} ${r.value.length} records`);
  } else {
    bucket[names[i]] = [];
    log(`     ${names[i].padEnd(12)} FAILED — ${r.reason.message}`);
  }
});

if (!bucket.googlenews.length && !bucket.bluesky.length) {
  console.error('Both tier-1 sources are down. Aborting rather than publishing a bad build.');
  process.exit(1);
}

// ---- 2. CLUSTER ------------------------------------------------------------
// 500+ headlines from 14 countries become ~35 actual stories.
log('2/7  clustering headlines into stories…');
const stories = clusterNews(bucket.googlenews);
log(`     ${bucket.googlenews.length} headlines → ${stories.length} stories`);

const records = [
  ...stories,
  ...bucket.bluesky,
  ...bucket.gtrends,
  ...bucket.reddit,
  ...bucket.wikipedia,
];

const aggregated = aggregate(records);

// ---- 3. COMPARE TO HISTORY -------------------------------------------------
log('3/7  loading previous reading…');
const previous = await loadPrevious(0.9); // news moves fast, so compare ~3h back
const prevIndex = indexSnapshot(previous);
log(`     ${previous ? `${prevIndex.size} entities from ${previous.takenAt}` : 'no history yet (first run)'}`);

// ---- 4. SCORE --------------------------------------------------------------
log('4/7  scoring…');
const raw = scoreAll(aggregated, prevIndex);
const scored = normalizeBySource(raw).map((r) => ({ ...r, status: classifyNorm(r.norm, r.ageDays) }));

// ---- 5. CONFIRM ACROSS SOURCES ---------------------------------------------
log('5/7  cross-checking sources…');
const confirmed = addConfirmation(scored);

// ---- 6. EXPLAIN ------------------------------------------------------------
log('6/7  enriching top stories…');
const top = diversify([...confirmed].sort((a, b) => b.finalScore - a.finalScore), 8, 30);
const enriched = await enrich(top, process.env.ANTHROPIC_API_KEY);
const map = new Map(enriched.map((e) => [`${e.source}::${e.entity}`, e]));
const final = confirmed.map((r) => map.get(`${r.source}::${r.entity}`) || r);

// ---- 7. SAVE + PUBLISH -----------------------------------------------------
log('7/7  saving snapshot and publishing…');
await saveSnapshot(aggregated);   // clustered records, so country counts persist

if (process.env.DRY_RUN) {
  log('\nDRY RUN — nothing written to docs/\n');
} else {
  const out = await publish(final);
  log(`     ignition ${out.ignition} · climbing ${out.climbing} · total ${out.total}`);
}
const sent = await sendAlerts(final, {
  token: process.env.TELEGRAM_TOKEN,
  chatId: process.env.TELEGRAM_CHAT_ID,
});
if (sent) log(`     ${sent} alert(s) sent`);
printTable(final);
log(`\ndone in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

function printTable(rows) {
  const shown = diversify([...rows].sort((a, b) => b.finalScore - a.finalScore), 4, 12);
  log('\n  SCORE  PHASE      CTRY  SRC          STORY');
  log('  ' + '-'.repeat(84));
  for (const r of shown) {
    log(
      '  ' + String(r.finalScore).padStart(5) +
      '  ' + String(r.phase || '-').padEnd(10) +
      ' ' + String(r.countryCount || 1).padStart(4) +
      '  ' + r.source.padEnd(12) +
      ' ' + r.entity.slice(0, 50)
    );
  }
}
