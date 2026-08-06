# Viral Radar

Finds which stories are **crossing borders right now** — while they are still
spreading, not after everyone has them.

---

## The idea in one line

> A story in one country is local news. The same story in eleven countries at
> once is a global event in progress. What matters is not how loud a story is —
> it is how fast that country count is growing.

Nobody sells that number, because you only get it by reading every country's news
feed at the same second, working out which differently-worded headlines are the
same story, and remembering what the count was three hours ago.

That is what this does.

---

## Where things actually go viral, in order

The honest map of how a global story travels, and what is reachable for free at
each stage:

| When | Stage | What we use | Reachable? |
|---|---|---|---|
| Minute 0 | Origin: X, TikTok, Telegram, WhatsApp | — | **No.** Paid or closed. |
| 0–60 min | Social chatter | **Bluesky trending** | Yes, free, no key |
| 0–2 hrs | Wire services pick it up | **Google News, 14 countries** | Yes, free, no key |
| 1–6 hrs | The public starts searching | **Google Trends, 8 countries** | Yes, free, no key |
| 2–8 hrs | Forums light up | **Reddit rising** | Yes, free (3-min setup for cloud) |
| Next day | People look it up properly | **Wikipedia, 7 languages** | Yes, free, official API |

**Be clear about the trade-off.** The true origin — X and TikTok — costs real
money, and for X that is roughly $200/month minimum. This build deliberately
starts one step later, at 0–60 minutes, because that step is free and stays free.
You will not be first in the world. You will be ahead of every newsroom that
waits for the wire, and hours ahead of the general public.

---

## How it works

```
  Bluesky trending      Google News x 14 countries
  Google Trends x 8     Reddit rising     Wikipedia x 7 languages
          |
          v
  1. COLLECT     all five, at the same moment
  2. CLUSTER     ~530 headlines -> ~35 actual stories
  3. COMPARE     against your own reading from 3 hours ago
  4. SCORE       spread, spread growth, acceleration, freshness, independence
  5. NORMALISE   judge each source against its own normal
  6. CONFIRM     does the same story appear on other sources too?
  7. EXPLAIN     one line on why it matters, one on what to do
          |
          v
  docs/index.html        dashboard
  docs/api/latest.json   your API
  docs/trend/*.html      one page per story
  newsletter/*.md        the brief you send
```

Runs on GitHub Actions every 3 hours. Costs **$0/month**.

---

## The clustering problem, and why it is the moat

Fourteen countries give ~530 headlines. The same event is written differently in
each one:

```
US : "Trump says Strait of Hormuz deal could happen soon amid Iran-Oman talks"
IN : "Hormuz deal possible soon, Trump tells reporters as Oman mediates"
AU : "Iran-Oman talks: Trump signals Hormuz breakthrough"
```

To a computer those are three unrelated strings. To you they are obviously one
story running in three countries. Until a machine can tell that automatically you
cannot count countries — and counting countries is the entire product.

`src/cluster.js` solves it by pulling out the words that survive a rewrite —
names, places, organisations — and grouping headlines that share enough of them.
It is deliberately not machine learning. It gets roughly 80% of stories right,
costs nothing, and never goes down.

Live test result: **532 headlines into 36 stories**, top story correctly
identified as running in 12 countries.

---

## What the labels mean

| Label | Meaning | What to do |
|---|---|---|
| `BREAKING` | Under 6 hours old, 1–3 countries | Watch. Might be nothing. |
| `SPREADING` | Gained 2+ new countries since the last reading | **This is the one.** Act now. |
| `GLOBAL` | 7+ countries carrying it | Everyone has it. Too late to be first. |
| `FADING` | Over 30 hours old | Done. |
| `SIGNAL` | An early hint from social or search | No country count available yet |
| `CONFIRMED` | Wikipedia lookups spiked | It was real, not media noise |

`SPREADING` is the whole reason this exists. Everything else is context.

---

## Quick start

```bash
npm install
npm run run          # full run
npm run dry          # run without writing the website
npm run serve        # preview the dashboard at localhost:3000
```

Full walkthrough: **[SETUP.md](SETUP.md)**

---

## Why this is defensible

Anyone can read today's news. Nobody else has **your record of how many countries
carried each story three hours ago.**

That history lives in `data/snapshots/`. It cannot be bought and cannot be
back-filled — it only accumulates by running. Someone starting three months after
you is permanently three months behind.

So: **start it running today, before you have decided what to sell.**

---

## Two filters that stop you publishing rubbish

**Publisher independence.** Twenty articles from twenty publishers is a real
story. Twenty articles that are one wire report reprinted is manufactured volume.
The score divides by publisher variety, so syndication cannot fake reach.

**Wikipedia confirmation.** Social chatter can be bots and news coverage can be
one press release. A million people individually choosing to look something up
cannot be faked. Wikipedia never tells you something first — it tells you whether
what you saw first was real.

---

## Adding a source

One file in `src/sources/` returning objects shaped like this:

```js
{
  source: 'yourfeed',
  kind: 'news',
  tier: 1,                 // 1 = earliest, 3 = confirmation only
  entity: 'Thing or headline',
  pos: 3,
  volume: 420,
  ageHours: 2.5,
  countryCount: 4,         // optional, but this is the valuable one
  url: 'https://...',
}
```

Add it to the `Promise.allSettled` array in `src/index.js`. Scoring,
normalisation and cross-checking then happen automatically.

Good next additions: GDELT (global news in 100+ languages — was unreachable when
this was built, worth retrying), Wikipedia EventStreams, national broadcaster RSS
feeds for non-English countries.

---

## Legal notes

- Headlines and view counts are **facts**. Facts are not copyrightable.
- Article **text** is. Never reproduce more than a headline. The enrichment
  prompt explicitly forbids it.
- All five sources are public feeds designed to be read by machines.
- Attribute your sources on the dashboard. Costs nothing, builds trust.

---

## Repository layout

```
src/
  index.js          the pipeline, top to bottom
  sources/          one file per data source
  cluster.js        turns 530 headlines into 35 stories   <- the hard part
  store.js          the history                           <- the asset
  score.js          spread-based scoring                  <- the product
  normalize.js      makes sources comparable
  crosscheck.js     cross-source confirmation
  dedupe.js         merges duplicates, keeps the brief varied
  enrich.js         plain-English why + what-to-do
  publish.js        builds dashboard, API, pages, newsletter
data/snapshots/     grows with every run
docs/               the website (GitHub Pages serves this)
newsletter/         brief drafts
```
