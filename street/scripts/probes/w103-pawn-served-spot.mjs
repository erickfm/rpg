// w103 / item 180 — does the pawn room now publish a "customer is SERVED" spot,
// and if so why is `interiors-walk`'s station check still falling back?
//
// `interiors-walk.mjs:1431` looks for a spot near the room whose label matches
// `/buy|order|serve|till|counter/i` and, finding none, falls back to the
// AUTHORED keeper pair — which it correctly refuses to trust, because a station
// authored in the same file as the keeper it checks is a mirror, not a test.
// pawn is one of the four rooms 251 recorded as failing that way.
//
// Item 180 has just added the thing that check is hunting for. This asks
// whether the ONLY reason it still fails is the five keywords, rather than
// guessing that from the regex. `interiors-walk.mjs` is not named by item 180,
// so this measures and reports instead of editing it (BUILDER-BRIEF §9).
import { chromium } from 'playwright';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForFunction(() => (window.__ct.painted?.()?.triangles ?? 0) > 0, { timeout: 20000 });

const r = await p.evaluate(() => {
  const dims = window.__ct.roomDims();
  const rooms = Array.isArray(dims) ? dims : Object.values(dims);
  const pawn = rooms.find((x) => x.id === 'pawn');
  if (!pawn) return { error: 'no pawn room', ids: rooms.map((x) => x.id) };
  // The harness's OWN population filter, copied with its citation rather than
  // reinvented: interiors-walk.mjs:1433.
  const near = window.__ct.spots()
    .filter((q) => q.x > 400 && Math.abs(q.x - pawn.cx) < 40);
  const OLD = /buy|order|serve|till|counter/i;
  const WIDE = /buy|order|serve|till|counter|sell|fence|pawn/i;
  return {
    cx: pawn.cx,
    spotsNearPawn: near.map((q) => ({ x: +q.x.toFixed(2), z: +q.z.toFixed(2), label: q.label })),
    matchedByHarnessToday: near.filter((q) => OLD.test(q.label || '')).map((q) => q.label),
    matchedIfSellAdded: near.filter((q) => WIDE.test(q.label || '')).map((q) => q.label),
  };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
