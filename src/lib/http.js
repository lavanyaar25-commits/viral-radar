// A small wrapper around fetch.
// Why this exists: free public endpoints fail sometimes. Instead of the whole
// pipeline crashing, we retry a few times and then give up quietly.

const UA = 'Mozilla/5.0 (compatible; trend-velocity/1.0)';

export async function get(url, { as = 'text', retries = 3, timeoutMs = 20000, headers = {} } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { 'user-agent': UA, ...headers },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return as === 'json' ? await res.json() : await res.text();
    } catch (err) {
      lastErr = err;
      // wait a bit longer after each failure: 1s, 2s, 4s
      await sleep(1000 * 2 ** (attempt - 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`GET failed after ${retries} tries: ${url} (${lastErr?.message})`);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Turn "4,664,499" or "+787,455" into a real number.
export const num = (s) => Number(String(s ?? '').replace(/[^\d.-]/g, '')) || 0;
