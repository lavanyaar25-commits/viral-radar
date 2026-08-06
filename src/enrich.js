// ENRICHMENT - turns numbers into something a customer will pay for.
//
// Raw output: "KAROL G - MATADORA, velocity 47, IGNITION".
// Enriched output: "Latin pop breakout, day 4. Angle for creators: dance/outfit
// content. Angle for sellers: nothing physical will arrive in time - go digital."
//
// The numbers are the moat. The angle is the thing people actually buy.
// Runs on Claude Haiku so a full daily brief costs well under one cent.

const MODEL = 'claude-haiku-4-5-20251001';

export async function enrich(items, apiKey) {
  if (!apiKey || !items.length) {
    return items.map((i) => ({ ...i, category: null, angle: null, why: null }));
  }

  const compact = items.map((i, idx) => ({
    id: idx,
    entity: i.entity,
    source: i.source,
    status: i.status,
    score: i.finalScore,
    ageDays: i.ageDays,
    platforms: i.platforms,
    context: i.headline || i.channel || null,
  }));

  const prompt = `You are a trend analyst writing for content creators, small agencies and online sellers.

For EACH item below, return:
- "category": one of music, film_tv, gaming, sports, tech, ai, news, product, person, meme, other
- "why": one plain sentence on why it is rising. If you do not know, say "Unclear from the data."
- "angle": one specific, actionable thing a creator or seller could do in the next 48 hours. Be concrete. No generic advice like "make content about it".

Rules: never invent facts you are not sure about. Do not quote lyrics or article text. Keep every field under 25 words.

Return ONLY a JSON array like [{"id":0,"category":"...","why":"...","angle":"..."}]. No markdown fences, no preamble.

ITEMS:
${JSON.stringify(compact)}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await res.json();
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());

    const byId = new Map(parsed.map((p) => [p.id, p]));
    return items.map((i, idx) => ({ ...i, ...pick(byId.get(idx)) }));
  } catch (err) {
    console.warn('  enrichment skipped:', err.message);
    return items.map((i) => ({ ...i, category: null, angle: null, why: null }));
  }
}

const pick = (p) => ({
  category: p?.category ?? null,
  why: p?.why ?? null,
  angle: p?.angle ?? null,
});
