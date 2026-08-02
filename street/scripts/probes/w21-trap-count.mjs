// DID THE NEW TIERS INVENT A TRAP? The `V` overlay colours a box red when
// ct/gap.ts's `trapAgainst` says it forms a 0.40-0.95 m corridor against a
// neighbour — the same function the parked-car draw is constrained by. So
// rather than re-implement that rule here (BUILDER-BRIEF §8), this turns the
// overlay on and reads back which boxes it painted red, by material colour.
//
// Prints the total and every red box, so a run against mainline and a run
// against a change can be compared line for line.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w21-trap-count.mjs
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4188/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.evaluate(() => window.__ct.debugCollision(true));
await p.waitForTimeout(800);

const red = await p.evaluate(() => {
  const cols = window.__ct.colliders();
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isLineSegments || !o.material || !o.material.color) return;
    if (o.material.color.getHex() !== 0xff3b3b) return;
    // the overlay builds one box per collider, in order — match on the drawn
    // footprint rather than trusting child order
    const cx = o.position.x, cz = o.position.z;
    const hit = cols.find((c) => Math.abs((c.minX + c.maxX) / 2 - cx) < 1e-6
      && Math.abs((c.minZ + c.maxZ) / 2 - cz) < 1e-6);
    out.push(hit ? { tag: hit.tag ?? null, minX: +hit.minX.toFixed(2), maxX: +hit.maxX.toFixed(2), minZ: +hit.minZ.toFixed(2), maxZ: +hit.maxZ.toFixed(2), maxY: hit.maxY ?? null }
      : { unmatched: [+cx.toFixed(2), +cz.toFixed(2)] });
  });
  return { total: cols.length, red: out };
});
console.log(`colliders ${red.total}, flagged as trap corridors: ${red.red.length}`);
for (const r of red.red.sort((a, b2) => JSON.stringify(a).localeCompare(JSON.stringify(b2)))) console.log('  ', JSON.stringify(r));
await b.close();
