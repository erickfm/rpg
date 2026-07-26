// THE FLAT-COLOUR GROUND CENSUS — the class A is fixing, counted reproducibly.
//
// A tried three predicates and published all three failures rather than a
// number (notes/A-flat-ground-routing.md), which is the most useful thing they
// could have handed me: roofs at y 1.6, CARS at y 0.59, and — the instructive
// one — civic invisible because its offenders are BOX TOP FACES in a materials
// array and the probe read mats[0].
//
// This is the predicate behind B's 123 / ~454 m², written down so it stops
// being one person's number.
//
//   1. GROUND-FACING, not just low. A surface counts if it is a flat plane
//      lying down, or the TOP face of a box. In three.js a BoxGeometry's
//      material array is [+x, -x, +y, -y, +z, -z], so the top face is
//      INDEX 2 — that single fact is why civic could not be seen.
//   2. OUTDOORS. |world x| > 100 is the interior belt (rooms sit out at
//      x 196..1000). The world's own grade uses the same test.
//   3. ON THE BLOCK, not on top of it: centre y <= 0.55 excludes roofs.
//   4. NOT A VEHICLE. Cars are 1.8 x 4.5 boxes sitting at y ~0.59; they are
//      flat-coloured on purpose and are nobody's ground.
//   5. REAL EXTENT: >= 0.5 m2, so trim, nosings and edge strips do not pad
//      the count.
//
// Usage: SHOT_URL=http://localhost:PORT/ node scripts/flat-ground.mjs
import { chromium } from 'playwright';
import { goto } from './lib/reachable.mjs';
import { reportWorld } from './lib/which-world.mjs';
import { setClock } from './lib/clock.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 500 } });
await goto(page, URL);
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, URL);
await setClock(page, 13, 0);

const r = await page.evaluate(() => {
  const rows = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    o.updateMatrixWorld(true);
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox, m = o.matrixWorld;
    const lo = bb.min.clone().applyMatrix4(m), hi = bb.max.clone().applyMatrix4(m);
    const cx = (lo.x + hi.x) / 2, cz = (lo.z + hi.z) / 2, topY = Math.max(lo.y, hi.y);
    const dx = Math.abs(hi.x - lo.x), dy = Math.abs(hi.y - lo.y), dz = Math.abs(hi.z - lo.z);
    if (Math.abs(cx) > 100) return;                       // 2. interiors
    if (topY > 0.55) return;                              // 3. roofs, and anything up a wall
    const area = dx * dz;
    if (area < 0.5) return;                               // 5. trim
    // 4. vehicles: a car-sized box standing off the ground
    if (dy > 0.35 && dx > 1.2 && dz > 3.0) return;
    const type = o.geometry.type;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    // 1. which material actually faces up
    let mat = null;
    if (type === 'BoxGeometry' && mats.length >= 3) mat = mats[2];   // +y face
    else if (dy <= 0.2) mat = mats[0];                               // a flat plane
    if (!mat || mat.map) return;
    if (mat.transparent && (mat.opacity ?? 1) < 0.6) return;         // decals, shadows
    let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
    rows.push({ mod: mod ?? '(unattributed)', area, x: +cx.toFixed(1), z: +cz.toFixed(1),
                col: '#' + mat.color.getHexString(), type });
  });
  const by = {};
  for (const q of rows) {
    by[q.mod] ??= { n: 0, area: 0, big: 0, at: '', tones: new Set() };
    const e = by[q.mod];
    e.n++; e.area += q.area; e.tones.add(q.col);
    if (q.area > e.big) { e.big = q.area; e.at = `${q.x}, ${q.z}`; }
  }
  return { total: rows.length, area: rows.reduce((a, q) => a + q.area, 0),
           mods: Object.entries(by).sort((a, b) => b[1].area - a[1].area)
             .map(([k, v]) => ({ mod: k, n: v.n, area: v.area, big: v.big, at: v.at, tones: v.tones.size })) };
});

console.log(`\n  ${r.total} flat-colour ground surfaces, ${r.area.toFixed(0)} m2\n`);
console.log('  module            count      m2   biggest   at                tones');
for (const m of r.mods)
  console.log(`  ${m.mod.padEnd(16)} ${String(m.n).padStart(5)}  ${m.area.toFixed(0).padStart(6)}` +
              `  ${m.big.toFixed(1).padStart(7)}   ${m.at.padEnd(16)}  ${m.tones}`);
console.log('\n  A surface counts if it faces UP, is outdoors, is on the block rather than');
console.log('  on top of it, is not a vehicle, and carries no map. Box top faces are');
console.log('  material index 2 — read mats[0] and civic vanishes.\n');
await browser.close();
