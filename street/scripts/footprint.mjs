// feat/ground — does anything on the ground straddle a step in it?
//
// Third generation of one bug. Flat-y put decals under the pan; surfaceY(x)
// fixed that by sampling at a POINT; then the litter became 3D solids with
// real extent and a point sample stopped being enough — the fountain cup ended
// up half inside the kerb. This is the check that should have existed after
// the first one, so it is written generally: walk everything near the ground,
// take its real world-space footprint, and ask two questions.
//
//   1. does the footprint CROSS the kerb line at |x| = ROAD_HALF? That is a
//      12 cm cliff and no single y is right for both sides of it.
//   2. is any part of it BELOW the ground under that part?
//
// Usage: SHOT_URL=http://localhost:4279/ node scripts/footprint.mjs
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await page.evaluate(() => window.__ct.clock(13, 0));
await page.waitForTimeout(900);

const r = await page.evaluate(() => {
  const THREE = window.__ct.three ?? null;
  const sc = window.__ct.scene();
  const RH = 5.0, GW = 0.45, KERB = 0.14, CH = 0.0625;
  const surf = (x) => {
    const ax = Math.abs(x);
    if (ax > RH) return KERB;
    if (ax > RH - GW) return 0.006 + (0.018 - 0.006) * ((RH - ax) / GW);
    return 0;
  };
  // the main street only — the side street and the car lot have their own
  // ground and their own owners
  const onStreet = (z, x) => z < 0 && z > -96 && Math.abs(x) < 7.2;

  const out = { litter: [], pits: [], water: [], crossers: [], sunk: [] };
  const box = (o) => {
    o.updateMatrixWorld(true);
    const b = { minX: Infinity, maxX: -Infinity, minY: Infinity };
    const g = o.geometry;
    if (!g) return null;
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox;
    for (const sx of [bb.min.x, bb.max.x]) {
      for (const sy of [bb.min.y, bb.max.y]) {
        for (const sz of [bb.min.z, bb.max.z]) {
          const v = { x: sx, y: sy, z: sz };
          const m = o.matrixWorld.elements;
          const wx = m[0] * v.x + m[4] * v.y + m[8] * v.z + m[12];
          const wy = m[1] * v.x + m[5] * v.y + m[9] * v.z + m[13];
          b.minX = Math.min(b.minX, wx); b.maxX = Math.max(b.maxX, wx);
          b.minY = Math.min(b.minY, wy);
        }
      }
    }
    return b;
  };

  const check = (o, label, bucket) => {
    const b = box(o);
    if (!b) return;
    const p = o.getWorldPosition(new (o.position.constructor)());
    if (!onStreet(p.z, p.x)) return;
    const rec = { label, x: +p.x.toFixed(3), z: +p.z.toFixed(1),
      minX: +b.minX.toFixed(3), maxX: +b.maxX.toFixed(3), minY: +b.minY.toFixed(4) };
    bucket.push(rec);
    for (const line of [RH, -RH]) {
      if (b.minX < line && b.maxX > line) out.crossers.push({ ...rec, line });
    }
    // sunk: the lowest corner is below the ground under the x it sits at.
    // 1 mm of tolerance, because a decal deliberately hugs its surface.
    const worst = Math.max(surf(b.minX), surf(b.maxX));
    if (b.minY < worst - 0.001) out.sunk.push({ ...rec, ground: +worst.toFixed(4) });
  };

  sc.traverse((o) => {
    if (o.userData?.litter) { o.traverse((c) => { if (c.isMesh) check(c, o.userData.litter, out.litter); }); return; }
    if (!o.isMesh) return;
    const img = o.material?.map?.image;
    // the tree pits: 0.6 x 1.0 planes on the walk
    const gp = o.geometry?.parameters;
    if (gp && Math.abs(gp.height - 1.0) < 1e-6 && gp.width < 0.95 && o.position.y < 0.3
        && Math.abs(o.position.x) > 4.5 && Math.abs(o.position.x) < 7) check(o, 'tree pit', out.pits);
    // puddle / track sheets
    if (img && ((img.width === 48 && img.height === 32) || (img.width === 16 && img.height === 64))
        && o.material.transparent && o.position.y < 0.3) check(o, 'water', out.water);
  });
  return out;
});

const n = (a) => a.length;
console.log(`\n  on the main street: ${n(r.litter)} litter meshes, ${n(r.pits)} tree pits, ${n(r.water)} water sheets`);
if (r.pits.length) {
  const inner = Math.min(...r.pits.map((p) => Math.abs(p.x) - (Math.abs(p.maxX) - Math.abs(p.x))));
  const gaps = r.pits.map((p) => +(Math.min(Math.abs(p.minX), Math.abs(p.maxX)) - (5.0 + 0.0625)).toFixed(3));
  const lo = Math.min(...gaps), hi = Math.max(...gaps);
  console.log(`  walk between kerb chamfer and pit edge: ${lo} … ${hi} m`);
  console.log(`  ${lo > 0.2 ? 'OK  ' : 'FAIL'} every pit sits inboard with a real strip of walk at the kerb`);
  console.log(`  ${(hi - lo) < 0.002 ? 'OK  ' : 'FAIL'} that strip is the same at every pit`);
  if (lo <= 0.2 || hi - lo >= 0.002) process.exitCode = 1;
}
console.log(`\n  ${!r.crossers.length ? 'OK  ' : 'FAIL'} nothing straddles the kerb line (${r.crossers.length})`);
for (const c of r.crossers.slice(0, 8)) console.log(`      ${c.label} at z ${c.z}: x ${c.minX} … ${c.maxX} crosses ${c.line}`);
console.log(`  ${!r.sunk.length ? 'OK  ' : 'FAIL'} nothing sits below the ground under it (${r.sunk.length})`);
for (const s of r.sunk.slice(0, 8)) console.log(`      ${s.label} at z ${s.z}: y ${s.minY} under ground ${s.ground}`);
if (r.crossers.length || r.sunk.length) process.exitCode = 1;

await browser.close();
if (errors.length) { console.error('\nPAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('\nno page errors');
