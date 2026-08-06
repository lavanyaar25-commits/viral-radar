// TIER 1 SOURCE — Bluesky trending topics.
//
// This is the closest thing to a free, open view of "what is being talked about
// on social media RIGHT NOW". Bluesky publishes its trending list openly, with
// no API key and no login, because the whole network is built on an open protocol.
//
// Why it matters for us: social chatter moves first. Search comes after. News
// articles come after that. Wikipedia lookups come last. Bluesky is our earliest
// warning bell.
//
// Honest limitation: Bluesky is smaller than X and skews tech/politics/US-UK.
// It will catch a political story fast and miss a Bollywood story completely.
// That is why it is one of five sources, not the only one.

import { get } from '../lib/http.js';

const ENDPOINT = 'https://public.api.bsky.app/xrpc/app.bsky.unspecced.getTrendingTopics?limit=25';

export async function fetchBluesky() {
  const data = await get(ENDPOINT, { as: 'json', retries: 2 });
  const topics = [...(data.topics || []), ...(data.suggested || [])];

  return topics.map((t, i) => ({
    source: 'bluesky',
    kind: 'social',
    tier: 1,                        // earliest signal
    entity: t.displayName || t.topic,
    pos: i + 1,
    // Bluesky does not publish a post count, so rank is our only measure.
    // Position 1 is worth much more than position 25, hence the steep curve.
    volume: Math.round(1000 / (i + 1)),
    countries: [],
    url: t.link ? `https://bsky.app${t.link}` : 'https://bsky.app',
  }));
}
