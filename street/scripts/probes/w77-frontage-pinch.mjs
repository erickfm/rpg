// NOT item 204 — a BYPRODUCT of it, named so the desk can queue it.
//
// Sweeping the west walk across the THRIFT frontage for item 204 turned up two
// cross-sections at 1.32 m against 2.27 m everywhere else, at z -64.8 and
// -65.3, and a ~1 s pause in the x -6.55 lane at z -63…-64 in both directions.
// Both are PRE-EXISTING — measured identically with the crate present and
// removed — and both are ABOVE ct/gap.ts's PASSABLE 0.95, so scripts/builtlane
// .mjs is right to pass them. This just names the box responsible.
//
//   SHOT_URL=http://localhost:4330/ node scripts/probes/w77-frontage-pinch.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4330/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.staticColliders !== undefined, { timeout: 30000 });
await p.waitForTimeout(600);

const r = await p.evaluate(() => {
  const all = window.__ct.staticColliders().filter((c) => c && isFinite(c.minX));
  // boxes that reach into the west walk (x -7.0..-5.0) anywhere in z -62…-67
  const hits = all.filter((c) => c.maxX > -7.0 && c.minX < -5.0 && c.maxZ > -67 && c.minZ < -62)
    .map((c) => ({ x: [+c.minX.toFixed(2), +c.maxX.toFixed(2)], z: [+c.minZ.toFixed(2), +c.maxZ.toFixed(2)] }));
  return { total: all.length, hits };
});
console.log(`static colliders in the world: ${r.total}`);
if (r.total < 50) { console.log('REFUSING TO REPORT: too few colliders — not measuring the world'); await b.close(); process.exit(3); }
console.log(`\nboxes intruding on the west walk (x -7.0…-5.0) between z -62 and -67: ${r.hits.length}`);
for (const h of r.hits) console.log(`  x ${JSON.stringify(h.x)}   z ${JSON.stringify(h.z)}`);
if (!r.hits.length) console.log('  (none — then the pinch is not static geometry and the pause is a citizen)');
await b.close();
