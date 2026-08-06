// SOURCE 3: Google Trends daily search trends (official RSS feed).
//
// What this gives us: what people are TYPING INTO GOOGLE right now, per country.
// This is the demand side. Spotify tells us what people play; this tells us what
// they are actively looking for - which is what you can actually rank for in search.
//
// No API key. No rate limit. This is a public RSS feed, so it is stable.

import * as cheerio from 'cheerio';
import { get } from '../lib/http.js';

const GEOS = ['US', 'GB', 'IN', 'AU', 'CA', 'BR', 'DE', 'ID'];

export async function fetchGoogleTrends() {
  const out = [];

  for (const geo of GEOS) {
    let xml;
    try {
      xml = await get(`https://trends.google.com/trending/rss?geo=${geo}`, { retries: 2 });
    } catch {
      continue;
    }

    const $ = cheerio.load(xml, { xmlMode: true });
    $('item').each((i, el) => {
      const $el = $(el);
      const term = $el.find('title').first().text().trim();
      if (!term) return;

      out.push({
        source: 'gtrends',
        kind: 'search',
        geo,
        entity: term,
        pos: i + 1,
        // "20,000+" -> 20000. This is Google's rough search volume bucket.
        volume: Number(($el.find('approx_traffic').text() || '0').replace(/[^\d]/g, '')) || 0,
        headline: $el.find('news_item_title').first().text().trim() || null,
        headlineUrl: $el.find('news_item_url').first().text().trim() || null,
        url: `https://trends.google.com/trends/explore?q=${encodeURIComponent(term)}&geo=${geo}`,
      });
    });
  }
  return out;
}
