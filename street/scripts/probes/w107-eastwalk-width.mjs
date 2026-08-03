// HOW WIDE IS THE EAST WALK, before any furniture is put on it?
//
// Item 269 offers four trades, three of which assume the pavement is wider than
// the bench. That is the assumption to test first: if the WALK ITSELF is under
// 2 m, moving the bench cannot reach 2 m and neither can moving the stop.
//
// Measures two things and does not infer either:
//   1. the KERB — the x at which the pavement surface starts, taken from the
//      walk sheet's own geometry, not from ROAD_HALF.
//   2. the BUILDING LINE — the lowest minX of any static collider tall enough
//      to be a wall, along the east side.
// Prints. Does not assert.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { goto } from '../lib/reachable.mjs';

const URL = aim('http://localhost:4188/');
const b = await chromium.launch();
const p = await b.newPage();
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

const out = await p.evaluate(() => {
  const scene = window.__ct.scene();
  scene.updateMatrixWorld(true);
  const THREE = window.__ct.three ? window.__ct.three() : null;

  // 1. every horizontal-ish sheet whose top sits at pavement height and which
  //    covers the east side around the stop
  const sheets = [];
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox, m = o.matrixWorld.elements;
    let mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9, mny = 1e9, mxy = -1e9;
    for (const X of [bb.min.x, bb.max.x]) for (const Y of [bb.min.y, bb.max.y]) for (const Z of [bb.min.z, bb.max.z]) {
      const wx = m[0]*X + m[4]*Y + m[8]*Z + m[12];
      const wy = m[1]*X + m[5]*Y + m[9]*Z + m[13];
      const wz = m[2]*X + m[6]*Y + m[10]*Z + m[14];
      if (wx < mnx) mnx = wx; if (wx > mxx) mxx = wx;
      if (wz < mnz) mnz = wz; if (wz > mxz) mxz = wz;
      if (wy < mny) mny = wy; if (wy > mxy) mxy = wy;
    }
    const h = mxy - mny;
    if (h > 0.6) return;                       // not a sheet
    if (mxy < -0.4 || mxy > 0.6) return;       // not at walk height
    if (mxz < -46 || mnz > -27) return;        // not at the stop
    if (mxx < 4.5 || mnx > 9) return;          // not on the east side
    if ((mxx - mnx) < 0.3 && (mxz - mnz) < 0.3) return;
    sheets.push({ mnx: +mnx.toFixed(3), mxx: +mxx.toFixed(3), mnz: +mnz.toFixed(2),
      mxz: +mxz.toFixed(2), top: +mxy.toFixed(3), name: o.name || '',
      ud: Object.keys(o.userData || {}).join(',') });
  });

  // 2. tall static colliders on the east side = the building line
  const walls = window.__ct.staticColliders()
    .filter((c) => c.maxZ > -46 && c.minZ < -27 && c.minX > 5.5 && c.minX < 12)
    .map((c) => ({ minX: +c.minX.toFixed(3), maxX: +c.maxX.toFixed(3),
      minZ: +c.minZ.toFixed(2), maxZ: +c.maxZ.toFixed(2) }));

  // 3. the ground height across the corridor at the stop, sampled — tells us
  //    where the walk surface really ends and the roadway begins
  const gy = [];
  for (let x = 4.4; x <= 7.4 + 1e-9; x += 0.05) {
    gy.push({ x: +x.toFixed(2), y: +window.__ct.groundAt(x, -38).toFixed(3) });
  }
  return { sheets, walls, gy };
});

console.log('\n=== SHEETS at walk height, east side, z -46..-27 ===');
for (const s of out.sheets) console.log(`  x ${s.mnx}..${s.mxx}  z ${s.mnz}..${s.mxz}  top ${s.top}  ${s.name} {${s.ud}}`);
console.log('\n=== tall static colliders, east side (the building line) ===');
for (const w of out.walls) console.log(`  x ${w.minX}..${w.maxX}  z ${w.minZ}..${w.maxZ}`);
console.log('\n=== groundAt(x, -38) across the corridor ===');
let prev = null;
for (const g of out.gy) {
  const mark = prev !== null && Math.abs(g.y - prev) > 0.01 ? '   <-- STEP' : '';
  console.log(`  x ${g.x.toFixed(2)}  y ${g.y.toFixed(3)}${mark}`);
  prev = g.y;
}
await b.close();
