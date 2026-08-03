// w100 / item 96 — WHAT IS THE RED MASS ON THE RIGHT OF bug-hotel-far.png?
//
// w97 surveyed the hotel and explicitly refused to guess at "a large untrimmed
// red mass fill[ing] the right ~40% of the frame". This measures it instead of
// guessing: it enumerates every mesh inside the hotel room's world AABB, with
// its own world-space bounding box, so the thing filling that part of the frame
// can be named by geometry rather than by eye.
//
// Usage: SHOT_URL=http://localhost:4562/ node scripts/probes/w100-hotel-mass.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL || 'http://localhost:4177/';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct && window.__ct.roomDims, null, { timeout: 30000 });

const room = await p.evaluate(() => window.__ct.roomDims().find((r) => r.id === 'hotel'));
if (!room) { console.log('NO HOTEL ROOM'); await b.close(); process.exit(1); }
console.log('hotel room dims:', JSON.stringify(room));

const dump = await p.evaluate(({ room }) => {
  const THREE = window.__ct.three ? window.__ct.three() : null;
  const scene = window.__ct.scene();
  const hw = room.w / 2, hd = room.d / 2;
  const x0 = room.cx - hw - 1.5, x1 = room.cx + hw + 1.5;
  const z0 = room.cz - hd - 1.5, z1 = room.cz + hd + 1.5;
  const out = [];
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    if (!g.boundingBox) return;
    // world AABB of the geometry box, corner by corner
    const bb = g.boundingBox;
    let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
    for (let i = 0; i < 8; i++) {
      const v = {
        x: (i & 1) ? bb.max.x : bb.min.x,
        y: (i & 2) ? bb.max.y : bb.min.y,
        z: (i & 4) ? bb.max.z : bb.min.z,
      };
      const w = new (o.position.constructor)(v.x, v.y, v.z).applyMatrix4(o.matrixWorld);
      mnx = Math.min(mnx, w.x); mxx = Math.max(mxx, w.x);
      mny = Math.min(mny, w.y); mxy = Math.max(mxy, w.y);
      mnz = Math.min(mnz, w.z); mxz = Math.max(mxz, w.z);
    }
    const cx = (mnx + mxx) / 2, cy = (mny + mxy) / 2, cz = (mnz + mxz) / 2;
    if (cx < x0 || cx > x1 || cz < z0 || cz > z1) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    out.push({
      type: g.type,
      name: o.name || '',
      par: (o.parent && o.parent.name) || '',
      cx: +cx.toFixed(2), cy: +cy.toFixed(2), cz: +cz.toFixed(2),
      w: +(mxx - mnx).toFixed(2), h: +(mxy - mny).toFixed(2), d: +(mxz - mnz).toFixed(2),
      col: mat && mat.color ? '#' + mat.color.getHexString() : '',
      map: !!(mat && mat.map),
      vis: o.visible,
    });
  });
  return out;
}, { room });

console.log(`meshes inside the hotel volume: ${dump.length}`);
// biggest by volume first — the "mass" is by definition a big one
dump.sort((a, c) => (c.w * c.h * c.d) - (a.w * a.h * a.d));
console.log('rank  vol      w×h×d              centre(x,y,z)         col      map  vis  type');
for (const m of dump.slice(0, 30)) {
  const vol = (m.w * m.h * m.d).toFixed(1).padStart(7);
  console.log(`${vol}  ${String(m.w).padStart(6)}×${String(m.h).padStart(5)}×${String(m.d).padStart(6)}  `
    + `${String(m.cx).padStart(7)},${String(m.cy).padStart(6)},${String(m.cz).padStart(8)}  `
    + `${(m.col || '-').padEnd(8)} ${m.map ? 'Y' : '.'}    ${m.vis ? 'Y' : '.'}    ${m.type}`);
}

// UNTEXTURED FURNITURE COUNT — w97's second finding, counted rather than asserted.
const flat = dump.filter((m) => !m.map && m.vis && m.type === 'BoxGeometry');
const flatBig = flat.filter((m) => m.w * m.h * m.d >= 0.05);
console.log(`\nvisible untextured (no map) BoxGeometry in this room: ${flat.length}`
  + ` (of which >= 0.05 m3: ${flatBig.length})`);

await b.close();
