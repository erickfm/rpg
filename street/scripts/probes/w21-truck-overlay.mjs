// LOOK at the four new tiers against the truck they describe, with the `V`
// collision overlay on — the one thing an assertion cannot answer is "does a
// box at 1.50 m over the greenhouse read as that truck's roof, or as a slab
// floating beside it". Screenshots for LOOKING, never for proving.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w21-truck-overlay.mjs
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4188/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.evaluate(() => window.__ct.clock(13, 0));

const cols = await p.evaluate(() => window.__ct.colliders());
const bed = cols.find((c) => c.tag === 'pickup-bed-floor');
const roof = cols.find((c) => c.tag === 'pickup-cab-roof');
const cx = (bed.minX + bed.maxX) / 2;
const midZ = (Math.min(bed.minZ, roof.minZ) + Math.max(bed.maxZ, roof.maxZ)) / 2;

for (const on of [false, true]) {
  await p.evaluate((v) => window.__ct.debugCollision(v), on);
  await p.waitForTimeout(400);
  // broadside from the kerb, and from the tail
  for (const [name, x, z, yaw, pitch] of [
    ['flank', cx + 5.0, midZ, -Math.PI / 2, -0.10],
    ['tail', cx, Math.max(bed.maxZ, roof.maxZ) > midZ ? Math.max(bed.maxZ, roof.maxZ) + 4.5 : Math.min(bed.minZ, roof.minZ) - 4.5,
      Math.max(bed.maxZ, roof.maxZ) > midZ ? 0 : Math.PI, -0.08],
  ]) {
    await p.evaluate(([x, z, y, pi]) => window.__ct.warp(x, z, y, 0.14, pi), [x, z, yaw, pitch]);
    await p.waitForTimeout(500);
    await p.screenshot({ path: `shots/w21-truck-${name}${on ? '-boxes' : ''}.png` });
  }
}
console.log('wrote shots/w21-truck-{flank,tail}{,-boxes}.png');
await b.close();
