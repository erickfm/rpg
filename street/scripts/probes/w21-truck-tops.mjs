// MEASURE BEFORE CHANGING (item 29). What can a player actually reach today?
//
// Dumps every collider that carries a `maxY` (the standable set), the parked
// truck's world transform, and the reach arithmetic the route depends on:
// fp.ts's jump is vy=4.0 against 14 m/s^2, so the apex is vy^2/2g, and
// standTop credits you a collider top once you are within TOP_EPS of it.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w21-truck-tops.mjs
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4188/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const cols = await p.evaluate(() => window.__ct.colliders());
const tops = cols.filter((c) => c.maxY !== undefined);
console.log(`colliders: ${cols.length}, standable (maxY set): ${tops.length}`);
for (const c of tops) console.log('  ', JSON.stringify(c));

// the truck: found from the scene, not from a typed coordinate
const truck = await p.evaluate(() => {
  const out = [];
  window.__ct.scene?.traverse?.(() => {});
  return out;
});
console.log('truck probe (scene accessor):', JSON.stringify(truck));

const APEX = 4.0 * 4.0 / (2 * 14);   // fp.ts:452/455 — vy=4.0, g=14
const TOP_EPS = 0.08;                // fp.ts:52
console.log(`apex ${APEX.toFixed(3)} m, TOP_EPS ${TOP_EPS} -> reach ${(APEX + TOP_EPS).toFixed(3)} m per hop`);
for (const from of [0, 0.14, 0.50, 0.76, 0.94, 0.97]) {
  console.log(`  from ${from.toFixed(2)} you can gain a top up to ${(from + APEX + TOP_EPS).toFixed(3)}`);
}
if (errs.length) console.log('page errors:', errs.slice(0, 5).join(' | '));
await b.close();
