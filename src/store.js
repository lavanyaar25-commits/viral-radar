// THE HISTORY STORE
//
// This is the single most valuable file in the project.
//
// Anyone can fetch today's chart. Nobody else has YOUR record of what those
// numbers were 6 hours ago, yesterday, and last week. That history is what
// lets you calculate speed. It cannot be bought or back-filled - it only
// accumulates by running. Every run makes the asset more valuable.
//
// We store plain JSON files inside the repo, so git itself is the database.
// Free, versioned, and you can move to Postgres later without changing anything
// upstream of this file.

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve('data');
const SNAP_DIR = path.join(DATA_DIR, 'snapshots');

export async function saveSnapshot(records) {
  await mkdir(SNAP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(SNAP_DIR, `${stamp}.json`);
  await writeFile(file, JSON.stringify({ takenAt: new Date().toISOString(), records }, null, 0));

  // Keep the last 120 snapshots (~30 days at 4 runs/day). Prevents repo bloat.
  const files = (await readdir(SNAP_DIR)).filter((f) => f.endsWith('.json')).sort();
  for (const old of files.slice(0, Math.max(0, files.length - 120))) {
    await writeFile(path.join(SNAP_DIR, old), ''); // truncate then leave for git rm
  }
  return file;
}

// Load the most recent snapshot that is at least `minAgeHours` old.
// We compare against that, not the immediately previous run, so that short-term
// noise does not look like a trend.
export async function loadPrevious(minAgeHours = 5) {
  try {
    const files = (await readdir(SNAP_DIR)).filter((f) => f.endsWith('.json')).sort().reverse();
    const cutoff = Date.now() - minAgeHours * 3.6e6;

    for (const f of files) {
      const raw = await readFile(path.join(SNAP_DIR, f), 'utf8');
      if (!raw) continue;
      const snap = JSON.parse(raw);
      if (Date.parse(snap.takenAt) <= cutoff) return snap;
    }
    // Nothing old enough yet (first few runs) - fall back to the oldest we have.
    for (const f of files.reverse()) {
      const raw = await readFile(path.join(SNAP_DIR, f), 'utf8');
      if (raw) return JSON.parse(raw);
    }
  } catch {
    /* first ever run */
  }
  return null;
}

// Build a lookup so we can ask "where was this entity last time?"
export function indexSnapshot(snap) {
  const map = new Map();
  if (!snap) return map;
  for (const r of snap.records) map.set(key(r), r);
  return map;
}

export const key = (r) => `${r.source}::${(r.entity || '').toLowerCase()}`;

export async function writeJson(relPath, obj) {
  const full = path.resolve(relPath);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, JSON.stringify(obj, null, 2));
  return full;
}
