// ALERTS - fires only when a story genuinely crosses borders.
// The key rule: never send the same story twice. A tool that repeats
// itself gets muted, and a muted tool is a cancelled subscription.

import { readFile, writeFile, mkdir } from 'node:fs/promises';

const SEEN_FILE = 'data/alerted.json';
const MIN_NEW_COUNTRIES = 2;   // must have gained this many since last hour

export async function sendAlerts(scored, { token, chatId }) {
  if (!token || !chatId) return 0;

  const seen = await loadSeen();
  const now = Date.now();

  // Only stories that gained countries in the last hour and are still young.
  const worthy = scored
    .filter((r) => r.source === 'googlenews')
    .filter((r) => r.newCountries >= MIN_NEW_COUNTRIES)
    .filter((r) => r.ageHours <= 12)
    .filter((r) => !seen[fingerprint(r)])
    .sort((a, b) => b.newCountries - a.newCountries)
    .slice(0, 3);   // three per hour maximum, no matter what

  for (const r of worthy) {
    await send(token, chatId, format(r));
    seen[fingerprint(r)] = now;
  }

  // Forget anything older than 48h so the file never grows forever.
  for (const [k, t] of Object.entries(seen)) {
    if (now - t > 48 * 3.6e6) delete seen[k];
  }
  await saveSeen(seen);

  return worthy.length;
}

// Match on the story's key names, not the headline. Headlines get reworded
// hourly; the names in them do not.
const fingerprint = (r) =>
  (r.keywords || []).slice(0, 4).sort().join('|') || r.entity.slice(0, 40);

function format(r) {
  return [
    `🔴 SPREADING`,
    ``,
    r.entity,
    ``,
    `Now in ${r.countryCount} countries (+${r.newCountries} in the last hour)`,
    `${Math.round(r.ageHours)}h old · ${r.publisherCount} publishers`,
    r.angle ? `\n${r.angle}` : '',
  ].join('\n');
}

async function send(token, chatId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
  } catch (e) {
    console.warn('  alert failed:', e.message);
  }
}

async function loadSeen() {
  try { return JSON.parse(await readFile(SEEN_FILE, 'utf8')); }
  catch { return {}; }
}

async function saveSeen(obj) {
  await mkdir('data', { recursive: true });
  await writeFile(SEEN_FILE, JSON.stringify(obj));
}
