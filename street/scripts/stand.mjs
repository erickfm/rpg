// STANDABILITY, done properly. A point is standable iff it lies inside no
// collider — checked against `__ct.colliders()`, the array `fp.ts` itself tests.
//
// This replaces the landing check that was not doing its job: `warp` sets the
// rig's position unconditionally and the rig only blocks movement, so a point
// inside solid brick "landed" happily. That produced a car-lot bounding box
// covering most of the block, and a camera pointed at a wall.
//
// Used here to FIND the car lot: the standable region east of the shopfronts.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
await p.goto('http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);

const res = await p.evaluate(() => {
  const R = 0.36;
  const cols = window.__ct.colliders().filter(c => c && isFinite(c.minX) && Math.abs(c.minX) < 500);
  const standable = (x, z) => !cols.some(c =>
    x > c.minX - R && x < c.maxX + R && z > c.minZ - R && z < c.maxZ + R);
  const pts = [];
  for (let x = 7; x <= 36; x += 0.5)
    for (let z = -6; z >= -62; z -= 0.5)
      if (standable(x, z)) pts.push([+x.toFixed(1), +z.toFixed(1)]);
  // connected components at 0.75 m, so the lot separates from the street
  const seen = new Set(), key = q => q.join(','), comps = [];
  const idx = new Map(pts.map(q => [key(q), q]));
  for (const q of pts) {
    if (seen.has(key(q))) continue;
    const stack = [q], mem = []; seen.add(key(q));
    while (stack.length) {
      const c = stack.pop(); mem.push(c);
      for (const dx of [-0.5, 0, 0.5]) for (const dz of [-0.5, 0, 0.5]) {
        const n = [+(c[0] + dx).toFixed(1), +(c[1] + dz).toFixed(1)];
        if (idx.has(key(n)) && !seen.has(key(n))) { seen.add(key(n)); stack.push(n); }
      }
    }
    const xs = mem.map(m => m[0]), zs = mem.map(m => m[1]);
    comps.push({ n: mem.length, x0: Math.min(...xs), x1: Math.max(...xs),
      z0: Math.min(...zs), z1: Math.max(...zs) });
  }
  return { nCols: cols.length, nStandable: pts.length, comps: comps.filter(c => c.n >= 12).sort((a, b2) => b2.n - a.n) };
});
console.log(`${res.nCols} colliders · ${res.nStandable} standable points east of the shopfronts`);
console.log('\nconnected standable regions (>=12 pts):');
for (const c of res.comps)
  console.log(`  ${String(c.n).padStart(4)} pts   x ${c.x0} … ${c.x1}   z ${c.z0} … ${c.z1}`);
writeFileSync('shots/stand.json', JSON.stringify(res, null, 2));

const big = res.comps[0];
if (big) {
  const look = (x, z, tx, tz) => Math.atan2(tx - x, -(tz - z));
  const cz = (big.z0 + big.z1) / 2, cx = (big.x0 + big.x1) / 2;
  const shots = [
    ['gate',  big.x0 + 0.6, cz, look(big.x0 + 0.6, cz, big.x1, cz), 0.05],
    ['mid',   cx, cz, look(cx, cz, big.x1, cz), 0.05],
    ['across', cx, big.z1 - 0.6, look(cx, big.z1 - 0.6, cx, big.z0), 0.05],
  ];
  for (const [l, x, z, yaw, pitch] of shots) {
    await p.evaluate(([x, z, yaw, pitch]) => window.__ct.warp(x, z, yaw, 0.14, pitch), [x, z, yaw, pitch]);
    await p.waitForTimeout(300);
    await p.screenshot({ path: `shots/lot2-${l}.png` });
    console.log(`  shot ${l} from (${x.toFixed(1)}, ${z.toFixed(1)})`);
  }
}
await b.close();
