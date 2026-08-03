// ITEM 228, STEP 0 — WHAT IS ACTUALLY OUT AT (-30, 12)?
//
// Worker seventynine reported a suspected third hole there and was explicit
// that it WARPED in and could not show the spot is reachable on foot. Before
// anything is walked, this maps the ground and the colliders across the whole
// north-west quadrant, so the walk that follows is aimed at something real.
//
// `groundPick` NEVER RETURNS NULL — it names a height for every point in R²,
// including void — so "there is ground here" is not a question this can ask.
// What it CAN ask is where the height jumps, which is what a floor's edge is.
//
// Usage: SHOT_URL=http://localhost:4370/ node scripts/probes/w81-item228-lay-of-the-land.mjs
import { chromium } from 'playwright';

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4370/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const out = await p.evaluate(() => {
  const g = (x, z) => window.__ct.groundAt(x, z);
  const rows = [];
  for (let z = 20; z >= 0; z -= 2) {
    const line = [];
    for (let x = -42; x <= 10; x += 2) line.push(g(x, z));
    rows.push({ z, line });
  }
  const cols = window.__ct.colliders();
  const near = cols.filter((c) => c.maxX > -42 && c.minX < 10 && c.maxZ > 0 && c.minZ < 22);
  return {
    rows,
    bounds: window.__ct.bounds ? window.__ct.bounds() : null,
    nearCount: near.length,
    near: near.slice(0, 40).map((c) => ({
      tag: c.tag ?? null,
      x: `${c.minX.toFixed(1)}..${c.maxX.toFixed(1)}`,
      z: `${c.minZ.toFixed(1)}..${c.maxZ.toFixed(1)}`,
      maxY: c.maxY ?? null,
    })),
    at: {
      '-30,12': g(-30, 12), '-30,18': g(-30, 18), '-30,6': g(-30, 6),
      '-20,12': g(-20, 12), '-10,12': g(-10, 12), '0,12': g(0, 12),
      '-30,0': g(-30, 0), '-36,12': g(-36, 12), '-42,12': g(-42, 12),
    },
  };
});

console.log(`bounds: ${JSON.stringify(out.bounds)}`);
console.log(`\nspot heights: ${JSON.stringify(out.at, null, 0)}`);
console.log('\nGROUND HEIGHT, x -42 … 10 (columns, 2 m), z 20 … 0 (rows, 2 m):');
console.log('     ' + Array.from({ length: 27 }, (_, i) => String(-42 + i * 2).padStart(6)).join(''));
for (const r of out.rows) {
  console.log(String(r.z).padStart(4) + ' ' + r.line.map((v) => v.toFixed(2).padStart(6)).join(''));
}
console.log(`\n${out.nearCount} colliders overlap this quadrant; first 40:`);
for (const c of out.near) console.log(`  ${String(c.tag ?? '').padEnd(20)} x ${c.x.padEnd(15)} z ${c.z.padEnd(15)} maxY ${c.maxY}`);
await browser.close();
