// Item 287 — ARE THE THREE "customer station comes from the world" REDS ONE BUG OR THREE?
//
// `interiors-walk.mjs:1436` accepts a published station only if its label matches
//   /buy|order|serve|till|counter/i
// and casino, hotel and tax all fall back to the AUTHORED pair. This lists what
// those rooms actually publish, so the answer comes from the world rather than
// from grepping source (BUILDER-BRIEF §7: find the number in the source, and the
// world is the source of what it publishes).
//
// Usage: SHOT_URL=http://localhost:4720/ node scripts/probes/w116-served-spots.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4720/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await p.goto(URL, { waitUntil: 'load', timeout: 30000 });
await p.waitForFunction(() => {
  const q = window.__ct?.painted?.();
  return !!q && q.frames > 0 && q.triangles > 0;
}, { timeout: 30000 });

const raw = await p.evaluate(() => window.__ct.roomDims?.() ?? null);
console.log('roomDims sample:', JSON.stringify(raw?.[0] ?? raw));
// It is an ARRAY of room records, not a map — key it by whatever id field it carries.
const dims = {};
for (const r of raw ?? []) dims[r.id ?? r.key ?? r.name] = r;
console.log('rooms published:', Object.keys(dims).join(', '));

// Spots are only registered once the interior is BUILT, and interiors build as
// the player enters them (GOTCHAS 79b — the spawn is inside 301, past the cull).
// So walk into each room before asking what it publishes.
const ROOMS = ['casino', 'hotel', 'tax', 'pawn', 'bodega', 'diner', 'burger'];
const RX = /buy|order|serve|till|counter/i;

for (const id of ROOMS) {
  const d = dims?.[id];
  if (!d) { console.log(`\n== ${id}: no roomDims entry`); continue; }
  await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [d.cx, d.cz ?? 0]);
  await p.waitForTimeout(700);
  const near = await p.evaluate(([rcx]) => (window.__ct.spots() ?? [])
    .filter((q) => q.x > 400 && Math.abs(q.x - rcx) < 40)
    .map((q) => ({ label: String(typeof q.label === 'function' ? q.label() : q.label), x: +q.x.toFixed(2), z: +q.z.toFixed(2) })), [d.cx]);
  console.log(`\n== ${id}  (cx ${d.cx})  ${near.length} spot(s) within 40 m`);
  for (const s of near) {
    console.log(`   ${RX.test(s.label) ? 'MATCH  ' : '       '}"${s.label}"  x${s.x} z${s.z}`);
  }
  console.log(`   -> regex accepts ${near.filter((s) => RX.test(s.label)).length} of ${near.length}`);
}
await b.close();
