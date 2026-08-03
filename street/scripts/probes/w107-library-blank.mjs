// WHICH FACES IN THE LIBRARY ARE BLANK BROWN BOARD, and which way do the books
// look? Item 273: *"some bookshelves are flat?"*
//
// The room's own comment (ct/int-library.ts:302-308) records this failure once
// already — a book PLANE left at rotation 0 hangs on the END of a bay pointing
// down the aisle, so the faces you walk between are blank board. So do not look
// for "flat"; look for TWO measurable things and print both:
//
//   1. every book plane's world NORMAL, and whether it points along the aisle
//      (+-x here) or down it (+-z). A run whose books face +-z is the bug.
//   2. every large UNTEXTURED face in the stack block — a mesh with a plain
//      colour material and no map, standing upright, big enough to read as a
//      panel. That is the "completely blank brown panel" in the desk's words.
//
// PRINTS. Does not assert — an investigation, and the complaint is about what a
// face SHOWS, so the frames beside it are the answer and this is the index.
//
// Authoring facts only: no `visible` filter anywhere (GOTCHAS 79/79b) — the
// library is an interior, interiors are culled until you are inside one, and a
// census run from spawn would find nothing at all.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { goto } from '../lib/reachable.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4188/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await waitPainted(p);

const lib = await p.evaluate(() => (window.__ct.roomDims() || []).find((r) => /libr/i.test(r.id)));
if (!lib) { console.log('NO LIBRARY ROOM IN roomDims() — cannot measure'); process.exit(3); }
console.log(`library "${lib.id}"  ${lib.w} x ${lib.d} m  centre (${lib.cx}, ${lib.cz})  floor y ${lib.y}`);

// stand inside it so the cull is not the thing being measured, then census
await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, 0, y ?? 0, 0), [lib.cx, lib.cz, lib.y]);
await waitPainted(p, { frames: 4 });

const out = await p.evaluate((lib) => {
  const T = window.__ct.three ? window.__ct.three() : null;
  const scene = window.__ct.scene();
  scene.updateMatrixWorld(true);
  const planes = [], blanks = [];
  const inRoom = (x, z) => Math.abs(x - lib.cx) < lib.w / 2 + 1 && Math.abs(z - lib.cz) < lib.d / 2 + 1;

  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry;
    g.computeBoundingBox();
    const bb = g.boundingBox, m = o.matrixWorld.elements;
    let mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9, mny = 1e9, mxy = -1e9;
    for (const X of [bb.min.x, bb.max.x]) for (const Y of [bb.min.y, bb.max.y]) for (const Z of [bb.min.z, bb.max.z]) {
      const wx = m[0]*X + m[4]*Y + m[8]*Z + m[12];
      const wy = m[1]*X + m[5]*Y + m[9]*Z + m[13];
      const wz = m[2]*X + m[6]*Y + m[10]*Z + m[14];
      if (wx < mnx) mnx = wx; if (wx > mxx) mxx = wx;
      if (wz < mnz) mnz = wz; if (wz > mxz) mxz = wz;
      if (wy < mny) mny = wy; if (wy > mxy) mxy = wy;
    }
    const cx = (mnx + mxx) / 2, cz = (mnz + mxz) / 2;
    if (!inRoom(cx, cz)) return;
    const w = mxx - mnx, h = mxy - mny, d = mxz - mnz;
    const mats = Array.isArray(o.material) ? o.material : [o.material];

    // 1. book planes — a PlaneGeometry with a map on it.
    //
    // NOT the range plates. They are `PlaneGeometry` with a map and they face
    // +-z by design (they are read square-on, standing in the aisle), so before
    // this exclusion the fix ITSELF pushed "z-facing" from 20 to 40 and the
    // number stopped meaning "a book plane hung on the end of a bay". A census
    // whose own subject changes what it counts is worse than no census.
    if (o.userData?.stackPlate) return;
    if (g.type === 'PlaneGeometry' && mats[0]?.map) {
      // the plane's own +z, taken into the world
      const n = { x: m[8], y: m[9], z: m[10] };
      const L = Math.hypot(n.x, n.y, n.z) || 1;
      planes.push({
        x: +cx.toFixed(2), y: +((mny + mxy) / 2).toFixed(2), z: +cz.toFixed(2),
        w: +w.toFixed(2), d: +d.toFixed(2),
        nx: +(n.x / L).toFixed(2), nz: +(n.z / L).toFixed(2),
        axis: Math.abs(n.x) > Math.abs(n.z) ? 'x' : 'z',
      });
      return;
    }
    // 2. big blank upright faces — a plain colour, no map anywhere on it
    const anyMap = mats.some((mm) => mm && mm.map);
    if (anyMap) return;
    if (h < 0.9) return;                     // not a panel
    const faceW = Math.max(w, d);
    if (faceW < 0.30) return;                // a post, not a panel
    if (mny > lib.y + 2.6) return;           // ceiling furniture
    blanks.push({
      x: +cx.toFixed(2), z: +cz.toFixed(2), w: +w.toFixed(2), h: +h.toFixed(2), d: +d.toFixed(2),
      colour: mats[0]?.color ? '#' + mats[0].color.getHexString() : '?',
      area: +(faceW * h).toFixed(2),
      name: o.name || Object.keys(o.userData || {}).join(',') || '',
    });
  });
  return { planes, blanks };
}, lib);

console.log(`\n=== ${out.planes.length} BOOK PLANES, by facing axis ===`);
const byAxis = { x: 0, z: 0 };
for (const pl of out.planes) byAxis[pl.axis]++;
console.log(`  facing along x (across an aisle): ${byAxis.x}`);
console.log(`  facing along z (down an aisle):   ${byAxis.z}`);
const odd = out.planes.filter((pl) => pl.axis === 'z');
for (const pl of odd.slice(0, 20)) {
  console.log(`    z-facing  at (${pl.x}, ${pl.z})  ${pl.w} x ${pl.d}  n=(${pl.nx}, ${pl.nz})`);
}

console.log(`\n=== ${out.blanks.length} BIG BLANK UNTEXTURED PANELS in the room ===`);
out.blanks.sort((a, c) => c.area - a.area);
for (const bl of out.blanks.slice(0, 40)) {
  console.log(`  ${String(bl.area).padStart(6)} m2  at (${String(bl.x).padStart(6)}, ${String(bl.z).padStart(6)})`
    + `  ${bl.w} x ${bl.h} x ${bl.d}  ${bl.colour}  ${bl.name}`);
}
const total = out.blanks.reduce((s, bl) => s + bl.area, 0);
console.log(`\nblank panel area, total: ${total.toFixed(1)} m2 over ${out.blanks.length} meshes`);
await b.close();
