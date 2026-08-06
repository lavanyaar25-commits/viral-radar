// TIER 2 SOURCE - Reddit rising posts.
//
// Reddit sits between social chatter and news. Something hitting r/all/rising is
// usually 2-6 hours ahead of the news cycle, and Reddit skews younger and more
// international than Bluesky, so it catches different stories.
//
// IMPORTANT, READ THIS: Reddit blocks requests coming from data centres unless
// you authenticate. That means:
//   - On your laptop:        works with no setup
//   - On GitHub Actions:     may be blocked, because that IS a data centre
//
// So we do two things. First, try the plain public feed. Second, if you have
// added free Reddit app credentials, use those instead - authenticated requests
// are allowed from anywhere.
//
// If both fail the pipeline shrugs and carries on with four other sources.
// Getting credentials takes 3 minutes and is described in SETUP.md.

import { get } from '../lib/http.js';

const SUBS = ['all/rising', 'worldnews/new', 'news/rising'];

export async function fetchReddit({ clientId, clientSecret } = {}) {
  const token = clientId && clientSecret ? await getToken(clientId, clientSecret) : null;
  const base = token ? 'https://oauth.reddit.com' : 'https://www.reddit.com';
  const headers = token ? { authorization: `Bearer ${token}` } : {};

  const out = [];
  for (const sub of SUBS) {
    let data;
    try {
      data = await get(`${base}/r/${sub}.json?limit=40`, { as: 'json', retries: 1, headers });
    } catch {
      continue; // blocked or down - not fatal
    }

    (data?.data?.children || []).forEach((child, i) => {
      const p = child.data;
      if (!p || p.stickied) return;
      const ageHours = Math.max((Date.now() / 1000 - p.created_utc) / 3600, 0.25);

      out.push({
        source: 'reddit',
        kind: 'social',
        tier: 2,
        entity: p.title,
        subreddit: p.subreddit,
        pos: i + 1,
        volume: p.score || 0,
        comments: p.num_comments || 0,
        ageHours: +ageHours.toFixed(1),
        // Upvotes per hour. On rising posts this is the real momentum measure.
        uph: +((p.score || 0) / ageHours).toFixed(1),
        url: `https://reddit.com${p.permalink}`,
      });
    });
  }

  // The same post appears in several of our feeds - keep the best sighting.
  const seen = new Map();
  for (const r of out) {
    const k = r.entity.toLowerCase();
    if (!seen.has(k) || seen.get(k).volume < r.volume) seen.set(k, r);
  }
  return [...seen.values()];
}

async function getToken(id, secret) {
  try {
    const res = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent': 'viral-radar/1.0',
      },
      body: 'grant_type=client_credentials',
    });
    const j = await res.json();
    return j.access_token || null;
  } catch {
    return null;
  }
}
