// Item 57: locate the "0.45 m trap" w24 reported — a 0.5x0.5 prop at x 5.75…6.25
// sitting 0.45 m off a block face at x 6.7, on the main street's east walk.
//
// The item names ct/bodega-corner.ts, which is a HYPOTHESIS. This probe asks the
// world which colliders actually live there, and what gap.ts says about each,
// before anything is edited. Static set only — crosstown.ts spreads moving
// vehicleBoxes into colliders(), so a single sample is not a number (w24).
//
// Usage: SHOT_URL=http://localhost:4193/ node scripts/probes/w30-trap57-locate.mjs
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4193/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const snap = () => p.evaluate(() => window.__ct.colliders()
  .map((c) => `${c.minX} ${c.maxX} ${c.minZ} ${c.maxZ} ${c.rot ?? 0}`));
const s1 = await snap();
await p.waitForTimeout(1000);
const s2 = await snap();
const still = s1.filter((k) => s2.includes(k));

const out = await p.evaluate(async (keep) => {
  const { trapAgainst } = await import('/src/proto/ct/gap.ts');
  const key = (c) => `${c.minX} ${c.maxX} ${c.minZ} ${c.maxZ} ${c.rot ?? 0}`;
  const set = new Set(keep);
  const cols = window.__ct.colliders().filter((c) => set.has(key(c)));
  const f = (n) => (n === undefined ? '--' : n.toFixed(3));
  // everything whose x-extent overlaps the window 4…8 — wide enough to catch
  // both the prop and whatever face it is measured against
  const near = cols.filter((c) => c.maxX > 4 && c.minX < 8);
  return {
    total: cols.length,
    rows: near.map((c) => {
      const w = trapAgainst(c, cols);
      return `x[${f(c.minX)},${f(c.maxX)}] z[${f(c.minZ)},${f(c.maxZ)}] `
        + `y[${f(c.minY)},${f(c.maxY)}] rot=${c.rot ?? 0} `
        + `${w === null ? 'ok' : 'RED gap=' + f(w)}`;
    }).sort(),
  };
}, still);

console.log(`static colliders: ${still.length} of ${s1.length}`);
console.log(`colliders overlapping x 4…8: ${out.rows.length}`);
for (const r of out.rows) console.log(r);
await b.close();
