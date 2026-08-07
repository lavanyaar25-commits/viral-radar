// PUBLISHER - turns the scored data into the four things you actually sell.
//
//   docs/index.html          the dashboard people look at
//   docs/api/latest.json     your free API (a static file IS an API)
//   docs/trend/<slug>.html   one SEO page per trend - the traffic engine
//   newsletter/<date>.md     the daily brief you send to paying subscribers
//
// Everything lands in docs/, which GitHub Pages serves for free.

import { writeJson } from './store.js';
import { diversify } from './dedupe.js';
import { writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

const SITE_NAME = 'Viral Radar';
const SITE_URL = process.env.SITE_URL || 'https://example.github.io/viral-radar';

export async function publish(scored) {
  const ranked = [...scored].sort((a, b) => b.finalScore - a.finalScore);
  // News-shaped buckets. What a reader wants to know is not "how big" but
  // "is this crossing borders right now, and did it start in the last hour".
  const news = ranked.filter((r) => r.source === 'googlenews');
  const spreading = news.filter((r) => r.phase === 'SPREADING' || r.phase === 'BREAKING').slice(0, 12);
  const global = news.filter((r) => r.phase === 'GLOBAL').slice(0, 12);
  const signals = diversify(
    ranked.filter((r) => r.source !== 'googlenews' && r.norm >= 60), 5, 12
  );

  // Keep these names so the rest of the file and the API stay stable.
  const ignition = [...spreading, ...signals].slice(0, 25);
  const climbing = global;
  const takenAt = new Date().toISOString();

  // 1. API -----------------------------------------------------------------
  await writeJson('docs/api/latest.json', {
    takenAt,
    counts: countBy(ranked, 'status'),
    ignition: ignition.map(apiShape),
    climbing: climbing.map(apiShape),
  });
  await writeJson('docs/api/all.json', { takenAt, records: ranked.slice(0, 400).map(apiShape) });

  // 2. Dashboard -----------------------------------------------------------
  await mkdir('docs', { recursive: true });
  await writeFile('docs/index.html', dashboard(ignition, climbing, takenAt));
  await writeFile('docs/.nojekyll', '');

  // 3. SEO pages -----------------------------------------------------------
  await mkdir('docs/trend', { recursive: true });
  for (const r of [...ignition, ...climbing]) {
    await writeFile(path.join('docs/trend', `${slug(r.entity)}.html`), trendPage(r, takenAt));
  }
  await writeFile('docs/sitemap.xml', await sitemap());

  // 4. Newsletter ----------------------------------------------------------
  await mkdir('newsletter', { recursive: true });
  // One file per HOUR, not per day. An hourly pipeline that writes a daily
  // file overwrites itself 23 times and you keep only the last reading.
  // Filenames like "2026-08-07-14.md" sort correctly and never collide.
  const stamp = takenAt.slice(0, 13).replace('T', '-');
  await writeFile(`newsletter/${stamp}.md`, brief(ignition, climbing, takenAt.slice(0, 16).replace('T', ' ')));
  //const date = takenAt.slice(0, 10);
  //await writeFile(`newsletter/${date}.md`, brief(ignition, climbing, date));

  return { ignition: ignition.length, climbing: climbing.length, total: ranked.length };
}

const apiShape = (r) => ({
  entity: r.entity, source: r.source, kind: r.kind, status: r.status, phase: r.phase,
  countries: r.countries, countryCount: r.countryCount, newCountries: r.newCountries,
  articleCount: r.articleCount, publisherCount: r.publisherCount, ageHours: r.ageHours,
  score: r.finalScore, velocity: r.velocity, pos: r.pos, ageDays: r.ageDays,
  platforms: r.platforms, confirmedOn: r.confirmedOn, confidence: r.confidence,
  category: r.category, why: r.why, angle: r.angle, url: r.url,
});

// URL-safe slug. normalize('NFD') + strip marks turns "fábio" into "fabio",
// which matters because search engines and file systems both prefer plain ASCII.
const slug = (s) =>
  String(s)
    .normalize('NFD').replace(/\p{M}/gu, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '').slice(0, 70) || 'trend';

const countBy = (arr, k) =>
  arr.reduce((acc, r) => ((acc[r[k]] = (acc[r[k]] || 0) + 1), acc), {});

const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Map a score onto a cold-to-hot position, 0-100.
const heat = (score) => Math.max(0, Math.min(100, Math.round((score / 60) * 100)));

// ---------------------------------------------------------------------------
// Shared styling. Reads like a measuring instrument on graph paper: cool paper
// ground, ink navy type, and a cold-to-hot scale that encodes real velocity.
// ---------------------------------------------------------------------------
const CSS = `
:root{
  --paper:#EEF1F6; --grid:#DDE3EC; --ink:#12182B; --ink-soft:#59627A;
  --rule:#C3CCDA; --cold:#3E63DD; --warm:#E8A33D; --hot:#E2483C; --card:#FFFFFF;
}
*{box-sizing:border-box}
body{
  margin:0; background:var(--paper);
  background-image:linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px);
  background-size:28px 28px;
  color:var(--ink); font-family:"IBM Plex Sans",system-ui,sans-serif; line-height:1.55;
}
.wrap{max-width:1080px;margin:0 auto;padding:40px 20px 80px}
h1{font-family:"Bricolage Grotesque","IBM Plex Sans",sans-serif;font-weight:800;
   font-size:clamp(2.1rem,6vw,3.6rem);line-height:.98;letter-spacing:-.03em;margin:0}
.eyebrow{font-family:"IBM Plex Mono",monospace;font-size:.7rem;letter-spacing:.22em;
   text-transform:uppercase;color:var(--ink-soft);margin:0 0 12px}
.lede{max-width:56ch;color:var(--ink-soft);margin:16px 0 0}
.rule{height:1px;background:var(--rule);margin:34px 0 26px}
.sec{font-family:"IBM Plex Mono",monospace;font-size:.72rem;letter-spacing:.18em;
   text-transform:uppercase;color:var(--ink-soft);margin:38px 0 14px}
.row{background:var(--card);border:1px solid var(--rule);border-radius:2px;
   padding:16px 18px;margin-bottom:10px}
.row-top{display:flex;gap:14px;align-items:baseline;flex-wrap:wrap}
.rank{font-family:"IBM Plex Mono",monospace;font-size:.78rem;color:var(--ink-soft);min-width:2.2em}
.name{font-weight:600;font-size:1.02rem;flex:1;min-width:220px}
.name a{color:inherit;text-decoration:none;border-bottom:1px solid var(--rule)}
.name a:hover{border-color:var(--ink)}
.score{font-family:"IBM Plex Mono",monospace;font-weight:600;font-size:1.02rem;font-variant-numeric:tabular-nums}
/* SIGNATURE: the velocity trace - a tick scale with a marker at the reading */
.trace{position:relative;height:26px;margin:12px 0 10px;
  background:repeating-linear-gradient(90deg,var(--rule) 0 1px,transparent 1px 10%);
  border-bottom:1px solid var(--rule)}
.trace i{position:absolute;top:2px;bottom:0;width:3px;border-radius:1px;
  transform:translateX(-1.5px);transition:left .5s cubic-bezier(.2,.8,.2,1)}
.meta{font-family:"IBM Plex Mono",monospace;font-size:.72rem;color:var(--ink-soft);
  display:flex;gap:16px;flex-wrap:wrap}
.tag{border:1px solid var(--rule);padding:1px 7px;border-radius:2px;font-size:.66rem;
  letter-spacing:.08em;text-transform:uppercase}
.angle{margin:10px 0 0;font-size:.92rem}
.angle b{font-family:"IBM Plex Mono",monospace;font-size:.68rem;letter-spacing:.14em;
  text-transform:uppercase;color:var(--ink-soft);display:block;margin-bottom:2px}
a.back{font-family:"IBM Plex Mono",monospace;font-size:.75rem;color:var(--ink-soft)}
footer{margin-top:56px;font-family:"IBM Plex Mono",monospace;font-size:.7rem;color:var(--ink-soft)}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
`;

const HEAD = (title, desc) => `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;600&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body><div class="wrap">`;

function traceBar(score) {
  const pct = heat(score);
  const color = pct > 66 ? 'var(--hot)' : pct > 33 ? 'var(--warm)' : 'var(--cold)';
  return `<div class="trace"><i style="left:${pct}%;background:${color}"></i></div>`;
}

function rowHtml(r, i) {
  return `<article class="row">
  <div class="row-top">
    <span class="rank">${String(i + 1).padStart(2, '0')}</span>
    <span class="name"><a href="trend/${slug(r.entity)}.html">${esc(r.entity)}</a></span>
    <span class="score">${r.finalScore}</span>
  </div>
  ${traceBar(r.finalScore)}
  <div class="meta">
    <span class="tag">${esc(r.phase || r.status)}</span>
    <span>${esc(r.source)}</span>
    ${r.countryCount > 1 ? `<span>${r.countryCount} countries</span>` : ''}
    ${r.newCountries > 0 ? `<span>+${r.newCountries} since last read</span>` : ''}
    <span>${r.ageHours < 24 ? `${Math.round(r.ageHours)}h old` : `${r.ageDays}d old`}</span>
    ${r.category ? `<span>${esc(r.category)}</span>` : ''}
  </div>
  ${r.angle ? `<p class="angle"><b>What to do</b>${esc(r.angle)}</p>` : ''}
</article>`;
}

function dashboard(ignition, climbing, takenAt) {
  return HEAD(
    `${SITE_NAME} — what is accelerating right now`,
    'Cross-platform trend detection. Ranked by speed, not popularity.'
  ) + `
<p class="eyebrow">Reading taken ${esc(takenAt.slice(0, 16).replace('T', ' '))} UTC</p>
<h1>What is crossing<br>borders right now.</h1>
<p class="lede">A story in one country is local news. The same story in eleven countries at once
is a global event in progress. This reads the news feeds of 14 countries at the same moment,
works out which headlines are the same story, and counts how fast that number is growing.</p>
<div class="rule"></div>
<p class="sec">Spreading now — crossing borders since the last reading</p>
${ignition.map(rowHtml).join('') || '<p class="lede">Nothing crossing borders this run. Quiet news cycle.</p>'}
<p class="sec">Already global — everyone has it</p>
${climbing.map(rowHtml).join('') || '<p class="lede">No story has reached seven countries yet.</p>'}
<footer>Updated every 3 hours · <a href="api/latest.json">JSON feed</a></footer>
</div></body></html>`;
}

function trendPage(r, takenAt) {
  const title = `Is "${r.entity}" still trending? — ${SITE_NAME}`;
  const ld = {
    '@context': 'https://schema.org', '@type': 'Article', headline: title,
    dateModified: takenAt, author: { '@type': 'Organization', name: SITE_NAME },
  };
  return HEAD(title, `Live velocity reading for ${r.entity}. Score ${r.finalScore}, status ${r.status}.`) + `
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<p class="eyebrow"><a class="back" href="../index.html">← All trends</a></p>
<h1>${esc(r.entity)}</h1>
<p class="lede">Status <strong>${esc(r.status)}</strong>. Velocity score ${r.finalScore},
measured ${esc(takenAt.slice(0, 10))}. Seen on ${r.platforms} platform${r.platforms > 1 ? 's' : ''}${
    r.confirmedOn?.length ? ` (confirmed on ${r.confirmedOn.join(', ')})` : ''}.</p>
${traceBar(r.finalScore)}
<div class="meta">
  <span>source ${esc(r.source)}</span><span>rank ${r.pos}</span>
  <span>day ${r.ageDays}</span><span>confidence ${r.confidence}</span>
</div>
<div class="rule"></div>
${r.why ? `<p class="sec">Why it is rising</p><p>${esc(r.why)}</p>` : ''}
${r.angle ? `<p class="sec">What to do about it</p><p>${esc(r.angle)}</p>` : ''}
<p class="sec">How this is measured</p>
<p>The score combines four things: how much faster it moved since the last reading,
how new it is, whether it is hitting a new personal best, and how much room it has left
to climb. A high score means it is still going up — not that it is already big.</p>
${r.url ? `<p><a href="${esc(r.url)}" rel="nofollow noopener">Source</a></p>` : ''}
<footer>Re-measured every 3 hours.</footer>
</div></body></html>`;
}

async function sitemap() {
  const files = await readdir('docs/trend').catch(() => []);
  const urls = ['', ...files.map((f) => `trend/${f}`)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE_URL}/${u}</loc><changefreq>hourly</changefreq></url>`).join('\n')}
</urlset>`;
}

function brief(ignition, climbing, date) {
  const line = (r, i) =>
    `**${i + 1}. ${r.entity}**\n` +
    `score ${r.finalScore} · ${r.countryCount > 1 ? `${r.countryCount} countries` : r.source}` +
    `${r.newCountries ? ` (+${r.newCountries} new)` : ''} · ${Math.round(r.ageHours)}h old\n` +
    (r.why ? `${r.why}\n` : '') +
    (r.angle ? `> **Do this:** ${r.angle}\n` : '');

  return `# Viral Radar — ${date}

**${ignition.length} stories are crossing borders right now.** These picked up new countries since the last reading three hours ago. That is the window before they are everywhere.

## Spreading now
${ignition.slice(0, 8).map(line).join('\n')}

## Already global
${climbing.slice(0, 5).map((r, i) => `${i + 1}. **${r.entity}** — ${r.countryCount} countries${r.angle ? ` — ${r.angle}` : ''}`).join('\n')}

---
*Read from Google News in 14 countries, Bluesky, Google Trends in 8 countries, Reddit and Wikipedia in 7 languages — all at the same moment. Scored on how fast a story is crossing borders, not how loud it is.*
`;
}
