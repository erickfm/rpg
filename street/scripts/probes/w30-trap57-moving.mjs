// Item 57 part 2: the static set has NOTHING at x 5.75…6.25, so what did w24
// measure? Dump the colliders that MOVE between two samples, with their size,
// and watch the x 5.5…6.5 window over time.
//
// w24's own note (notes/w24-collider-rotation.md) says citizens carry boxes into
// colliders(); w22's said a citizen box is 0.5x0.5 — exactly the width of the
// "0.5 x 0.5 prop" item 57 is filed against. This asks the world directly.
//
// Usage: SHOT_URL=http://localhost:4193/ node scripts/probes/w30-trap57-moving.mjs
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4193/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const snap = () => p.evaluate(() => window.__ct.colliders()
  .map((c) => ({ minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ, rot: c.rot ?? 0 })));
const key = (c) => `${c.minX} ${c.maxX} ${c.minZ} ${c.maxZ} ${c.rot}`;

const s1 = await snap();
await p.waitForTimeout(1000);
const s2 = await snap();
const set1 = new Set(s1.map(key));
const moved = s2.filter((c) => !set1.has(key(c)));
const f = (n) => n.toFixed(3);
console.log(`total ${s2.length}, moving ${moved.length}`);
for (const c of moved.sort((a, z) => a.minX - z.minX)) {
  console.log(`  MOVING x[${f(c.minX)},${f(c.maxX)}] z[${f(c.minZ)},${f(c.maxZ)}] `
    + `w=${f(c.maxX - c.minX)} d=${f(c.maxZ - c.minZ)}`);
}

// now watch the window the item names, for 30 s
console.log('--- watching x 5.5…6.5 for 30 s ---');
const seen = new Map();
for (let i = 0; i < 60; i++) {
  const s = await snap();
  for (const c of s) {
    if (c.maxX > 5.5 && c.minX < 6.5) {
      const k = `${f(c.minX)},${f(c.maxX)} w=${f(c.maxX - c.minX)} d=${f(c.maxZ - c.minZ)}`;
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
  }
  await p.waitForTimeout(500);
}
if (seen.size === 0) console.log('  NOTHING ever occupied x 5.5…6.5 in 60 samples');
for (const [k, n] of [...seen].sort((a, z) => z[1] - a[1]).slice(0, 25)) {
  console.log(`  x[${k}]  seen ${n}/60`);
}
await b.close();
