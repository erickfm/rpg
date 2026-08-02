// WORLD-WIDE SHADOW-GEOMETRY CENSUS — item 0a.
//
// Starts from notes/AUDIT-shadow-geometry.md's predicate ("131 meshes,
// ~1092 m2" against build 55c7df614: largest face horizontal, world y in
// [-0.35, 0.55], area >= 1 m2, material.map absent on at least one
// submaterial) but corrects ONE bug in it, found by running it here: "absent
// on at least one submaterial" flags a box's DARK RISER SIDES even when its
// TOP face — the only face anyone ever sees, the one slabTex/walkTex paints —
// carries a real map. That is exactly the GOTCHAS box-top-face trap in
// reverse (flat-ground.mjs's comment: "Box top faces are material index 2 —
// read mats[0] and civic vanishes"), and it is why this script's first run
// counted the entire west sidewalk slab (245 m2, one box, top properly
// textured) as a shadow-geometry offender. Fixed by reading the TOP-FACING
// material specifically: index 2 of a 6-entry box array, or mats[0] for a
// near-flat plane — same rule flat-ground.mjs already proved outdoors, now
// applied world-wide (indoor + outdoor) rather than its |x|<=100 outdoor-only
// scope, which is why the two totals still legitimately disagree.
//
// Usage: SHOT_URL=http://localhost:PORT/ node scripts/w5-shadow-census.mjs
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { goto } from './lib/reachable.mjs';
import { reportWorld } from './lib/which-world.mjs';
import { setClock } from './lib/clock.mjs';

const URL = aim('http://localhost:4177/');
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
    const cx = (lo.x + hi.x) / 2, cy = (lo.y + hi.y) / 2, cz = (lo.z + hi.z) / 2;
    const dx = Math.abs(hi.x - lo.x), dy = Math.abs(hi.y - lo.y), dz = Math.abs(hi.z - lo.z);
    if (cy < -0.35 || cy > 0.55) return;               // world y band
    // "largest face horizontal": the x-z footprint area beats both side areas
    const areaXZ = dx * dz, areaXY = dx * dy, areaZY = dz * dy;
    if (areaXZ < areaXY || areaXZ < areaZY) return;
    if (areaXZ < 1) return;                             // >= 1 m2
    // GOTCHAS 4: a strip under ~0.3 m in its narrow in-plane dimension cannot
    // hold texture detail without aliasing — texturing it would not read as
    // paving, it would read as noise. Found live: 13 "street" hits here were
    // all long (~13 m), 0.09-0.20 m WIDE facade trim/belt-course bands, not
    // ground. Excluding them is not loosening the check (BRIEF 7) — it is the
    // documented exemption the audit itself flagged but never applied.
    if (Math.min(dx, dz) < 0.3) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    // READ THE TOP-FACING MATERIAL, not "any submaterial" — a box's dark
    // riser sides are legitimately flat and unmapped; only the top is ground.
    let mat = null;
    if (o.geometry.type === 'BoxGeometry' && mats.length >= 3) mat = mats[2];
    else mat = mats[0];
    if (!mat || mat.map) return;
    if (mat.transparent && (mat.opacity ?? 1) < 0.6) return; // decals, contact shadows
    let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
    const col = (() => { const mt = mats.find((x) => x && x.color); return mt ? '#' + mt.color.getHexString() : '?'; })();
    rows.push({ mod: mod ?? '(unattributed)', area: areaXZ, x: +cx.toFixed(1), z: +cz.toFixed(1),
                indoor: Math.abs(cx) > 196 || Math.abs(cz) > 500, col, name: o.name || o.geometry.type });
  });
  const by = {};
  for (const q of rows) {
    const zone = q.indoor ? 'indoor' : 'outdoor';
    const key = `${zone}:${q.mod}`;
    by[key] ??= { zone, mod: q.mod, n: 0, area: 0, big: 0, at: '' };
    const e = by[key];
    e.n++; e.area += q.area;
    if (q.area > e.big) { e.big = q.area; e.at = `${q.x}, ${q.z}`; }
  }
  return {
    total: rows.length, area: rows.reduce((a, q) => a + q.area, 0),
    outdoorN: rows.filter(q => !q.indoor).length, outdoorArea: rows.filter(q => !q.indoor).reduce((a,q)=>a+q.area,0),
    indoorN: rows.filter(q => q.indoor).length, indoorArea: rows.filter(q => q.indoor).reduce((a,q)=>a+q.area,0),
    mods: Object.values(by).sort((a, b) => b.area - a.area),
    rows,
  };
});

console.log(`\n  ${r.total} unmapped ground-facing meshes, ${r.area.toFixed(0)} m2 total`);
console.log(`  outdoor: ${r.outdoorN} meshes, ${r.outdoorArea.toFixed(0)} m2`);
console.log(`  indoor:  ${r.indoorN} meshes, ${r.indoorArea.toFixed(0)} m2\n`);
console.log('  zone     module            count      m2   biggest   at');
for (const m of r.mods)
  console.log(`  ${m.zone.padEnd(8)} ${m.mod.padEnd(16)} ${String(m.n).padStart(5)}  ${m.area.toFixed(0).padStart(6)}` +
              `  ${m.big.toFixed(1).padStart(7)}   ${m.at}`);

if (process.env.CENSUS_DETAIL) {
  console.log('\n  --- full row detail ---');
  for (const q of r.rows) console.log(`  ${(q.indoor?'in ':'out')} ${q.mod.padEnd(14)} ${q.area.toFixed(1).padStart(6)} m2  at ${q.x},${q.z}  ${q.col}  ${q.name}`);
}
await browser.close();
