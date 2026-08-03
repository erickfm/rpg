// ITEM 158 — the stand's solid() must have gone with its meshes.
// A removed object that leaves its collider behind is an invisible wall, which
// is worse than the object was: you cannot see why you cannot walk there.
// Reports every collider overlapping the stand's old footprint
// (world x 1070.35 +/- 0.35, z -1.9 +/- 0.65) — the wall itself is expected,
// anything free-standing in front of it is not.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL || 'http://localhost:4430/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 520 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
const out = await p.evaluate(() => {
  const X = 1070.35, Z = -1.9, HX = 0.35, HZ = 0.65;
  const hits = [];
  for (const c of window.__ct.colliders() || []) {
    if (!c || typeof c.minX !== 'number') continue;
    if (c.maxX < X - HX || c.minX > X + HX) continue;
    if (c.maxZ < Z - HZ || c.minZ > Z + HZ) continue;
    hits.push({ x: [+c.minX.toFixed(2), +c.maxX.toFixed(2)], z: [+c.minZ.toFixed(2), +c.maxZ.toFixed(2)],
      w: +(c.maxX - c.minX).toFixed(2), d: +(c.maxZ - c.minZ).toFixed(2) });
  }
  return hits;
});
console.log(`colliders overlapping the stand's old footprint: ${out.length}`);
for (const h of out) console.log(`  x[${h.x}] z[${h.z}]  ${h.w} x ${h.d} m`);
console.log(out.some((h) => h.w < 2 && h.d < 3)
  ? '\n*** a small free-standing collider is still there — phantom obstruction ***'
  : '\nno free-standing collider left behind');
await b.close();
