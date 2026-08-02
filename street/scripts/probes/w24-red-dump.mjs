// Dump EVERY collider the V overlay would paint red, as a stable sorted list,
// so a before/after pair can be diffed line by line. Item 36 dropped the
// world-wide red count from 171 to 166 and only two of those were chamfer
// bands; this is how the other three were accounted for rather than assumed.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w24-red-dump.mjs > /tmp/x
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4210/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
// THE STATIC SET ONLY. `crosstown.ts` spreads `vehicleBoxes` into `colliders`,
// and those move every frame as traffic crosses the junction — so the raw
// world-wide red count is not a number at all: two runs of the SAME build gave
// 171 and 166. Comparing them would have been the instrument reporting a change
// the world never made. So a collider counts only if its footprint is identical
// in two samples taken a second apart.
const snap = () => p.evaluate(() => window.__ct.colliders()
  .map((c) => `${c.minX} ${c.maxX} ${c.minZ} ${c.maxZ} ${c.rot ?? 0}`));
const s1 = await snap();
await p.waitForTimeout(1000);
const s2 = await snap();
const still = s1.filter((k) => s2.includes(k));
const rows = await p.evaluate(async (keep) => {
  const { trapAgainst } = await import('/src/proto/ct/gap.ts');
  const key = (c) => `${c.minX} ${c.maxX} ${c.minZ} ${c.maxZ} ${c.rot ?? 0}`;
  const set = new Set(keep);
  const cols = window.__ct.colliders().filter((c) => set.has(key(c)));
  const f = (n) => n.toFixed(3);
  return cols.map((c) => {
    const w = trapAgainst(c, cols);
    return w === null ? null
      : `${f(c.minX)} ${f(c.maxX)} ${f(c.minZ)} ${f(c.maxZ)} rot=${c.rot ?? 0} gap=${f(w)}`;
  }).filter(Boolean).sort();
}, still);
console.log(`static colliders: ${still.length} of ${s1.length}`);
console.log(`total colliders / red: see counts below`);
for (const r of rows) console.log(r);
console.log(`RED ${rows.length}`);
await b.close();
