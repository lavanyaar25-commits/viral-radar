// TIER 1 SOURCE — Google News, read from 14 countries at the same moment.
//
// THIS IS THE MOST IMPORTANT FILE IN THE PROJECT.
//
// A story that leads the news in one country is local news. The exact same story
// leading the news in eleven countries at once is a global event in progress.
// The number of countries carrying a story - and how fast that number is growing -
// is the single best measure of "going viral worldwide" that you can get for free.
//
// Nobody sells this, because you only see it if you read every country's feed at
// the same second and then work out which headlines are about the same thing.
// That second part is the hard bit, and it is what cluster.js does.

import * as cheerio from 'cheerio';
import { get } from '../lib/http.js';

// Chosen for reach and language spread, not just size.
// Each entry: [country code, language, label]
const EDITIONS = [
  ['US', 'en-US', 'United States'],
  ['GB', 'en-GB', 'United Kingdom'],
  ['IN', 'en-IN', 'India'],
  ['AU', 'en-AU', 'Australia'],
  ['CA', 'en-CA', 'Canada'],
  ['ZA', 'en-ZA', 'South Africa'],
  ['SG', 'en-SG', 'Singapore'],
  ['IE', 'en-IE', 'Ireland'],
  ['NG', 'en-NG', 'Nigeria'],
  ['PH', 'en-PH', 'Philippines'],
  ['NZ', 'en-NZ', 'New Zealand'],
  ['PK', 'en-PK', 'Pakistan'],
  ['KE', 'en-KE', 'Kenya'],
  ['MY', 'en-MY', 'Malaysia'],
];

// We keep every edition in English so headlines about the same story actually
// share words and can be matched. Adding French or Japanese editions would need
// translation first - a good upgrade later, not on day one.

export async function fetchGoogleNews() {
  const out = [];

  for (const [country, lang] of EDITIONS) {
    const url = `https://news.google.com/rss?hl=${lang}&gl=${country}&ceid=${country}:${lang.split('-')[0]}`;

    let xml;
    try {
      xml = await get(url, { retries: 2 });
    } catch {
      continue; // one country failing must not stop the run
    }

    const $ = cheerio.load(xml, { xmlMode: true });
    $('item').slice(0, 40).each((i, el) => {
      const $el = $(el);
      const raw = $el.find('title').first().text().trim();
      if (!raw) return;

      // Google formats titles as "Headline - Publisher". Split the publisher off.
      const cut = raw.lastIndexOf(' - ');
      const headline = cut > 20 ? raw.slice(0, cut) : raw;
      const publisher = cut > 20 ? raw.slice(cut + 3) : null;

      const published = Date.parse($el.find('pubDate').text()) || Date.now();

      out.push({
        source: 'googlenews',
        kind: 'news',
        tier: 1,
        country,
        headline,
        publisher,
        // Rank in that country's feed. 1 = top story there.
        pos: i + 1,
        publishedAt: new Date(published).toISOString(),
        ageHours: Math.max((Date.now() - published) / 3.6e6, 0.25),
        url: $el.find('link').text().trim(),
      });
    });
  }

  return out;
}

export const EDITION_COUNT = EDITIONS.length;
