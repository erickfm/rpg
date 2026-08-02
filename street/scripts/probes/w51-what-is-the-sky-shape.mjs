// ITEM 132 — "a dark angular shape sits above the facade against the sky,
// apparently unattached". Identify it from the user's OWN hero frame.
//
// Method: project every visible mesh's world bounding box into screen space
// through the live camera and report the ones whose screen box covers the
// target pixels, nearest first. A signature sweep over "tall and thin near the
// facade" (w46's method) cannot find this one — it is against the SKY, so the
// only thing that localises it is the pixel it occupies.
//
// The page publishes no `three` (see scripts/lib/D-see.mjs:26), so the Vector3
// used for the projection is CLONED FROM `cam.position` rather than
// constructed — that is the only handle on the class from outside the bundle.
//
// Usage: SHOT_URL=http://localhost:4183/ node scripts/probes/w51-what-is-the-sky-shape.mjs
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4183/';
const VW = 1160, VH = 819;
// the hero station, from scripts/probes/w46-facade-shot.mjs
const ST = { x: 53.6, z: -103.2, yaw: Math.PI, pitch: 0.62 };
// the dark shape's screen footprint in shots/w46/w51-before-hero.png
const TARGET = { x0: 610, x1: 690, y0: 10, y1: 160 };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: VW, height: VH } });
p.on('console', (m) => { if (m.type() === 'error') console.log('  console error:', m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.evaluate((h) => window.__ct.clock(h, 10), Number(process.env.HOUR ?? 23));
await p.waitForTimeout(1600);
await p.evaluate((q) => window.__ct.warp(q.x, q.z, q.yaw, undefined, q.pitch), ST);
await p.waitForTimeout(700);
const [gx, , gz] = await p.evaluate(() => window.__ct.pos());
if (Math.hypot(gx - ST.x, gz - ST.z) > 0.05) {
  console.log(`warp landed ${Math.hypot(gx - ST.x, gz - ST.z).toFixed(2)} m off — refusing to report`);
  await b.close(); process.exit(1);
}

const r = await p.evaluate(({ vw, vh, T }) => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const cam = window.__ct.camera();
  cam.updateMatrixWorld(true);
  const v = cam.position.clone();                 // the only Vector3 handle we have
  const out = [];
  s.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    for (let q = o; q; q = q.parent) if (q.visible === false) return;
    const g = o.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    if (!g.boundingBox) return;
    const bb = g.boundingBox;
    let sx0 = 1e9, sx1 = -1e9, sy0 = 1e9, sy1 = -1e9, dmin = 1e9, behind = 0;
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z);
      v.applyMatrix4(o.matrixWorld);
      const d = v.distanceTo(cam.position);
      if (d < dmin) dmin = d;
      v.project(cam);
      if (v.z > 1) { behind++; continue; }
      const px = (v.x * 0.5 + 0.5) * vw, py = (-v.y * 0.5 + 0.5) * vh;
      if (px < sx0) sx0 = px; if (px > sx1) sx1 = px;
      if (py < sy0) sy0 = py; if (py > sy1) sy1 = py;
    }
    if (behind === 8) return;
    // must overlap the target rectangle on screen
    if (sx1 < T.x0 || sx0 > T.x1 || sy1 < T.y0 || sy0 > T.y1) return;
    // and must not be a huge backdrop that covers everything
    if (sx1 - sx0 > vw * 1.6 && sy1 - sy0 > vh * 1.6) return;
    const wb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    out.push({
      d: +dmin.toFixed(2),
      type: g.type,
      wx: [+wb.min.x.toFixed(2), +wb.max.x.toFixed(2)],
      wy: [+wb.min.y.toFixed(2), +wb.max.y.toFixed(2)],
      wz: [+wb.min.z.toFixed(2), +wb.max.z.toFixed(2)],
      size: [+(wb.max.x - wb.min.x).toFixed(2), +(wb.max.y - wb.min.y).toFixed(2), +(wb.max.z - wb.min.z).toFixed(2)],
      scr: [Math.round(sx0), Math.round(sy0), Math.round(sx1), Math.round(sy1)],
      rot: [+o.rotation.x.toFixed(2), +o.rotation.y.toFixed(2), +o.rotation.z.toFixed(2)],
      col: '#' + (m?.color ? m.color.getHexString() : '??'),
      map: m?.map?.image ? `${m.map.image.width}x${m.map.image.height}` : '-',
      fog: m?.fog, op: m?.opacity,
    });
  });
  return out.sort((a, c) => a.d - c.d);
}, { vw: VW, vh: VH, T: TARGET });

console.log(`meshes whose screen box covers px ${TARGET.x0}..${TARGET.x1} x ${TARGET.y0}..${TARGET.y1}: ${r.length}`);
console.log(`(nearest first; the dark shape is the nearest one that is DARK and covers the whole rectangle)\n`);
for (const o of r) {
  console.log(`d=${String(o.d).padStart(7)}  ${o.type.padEnd(14)} `
    + `x ${String(o.wx[0]).padStart(7)}..${String(o.wx[1]).padEnd(7)} `
    + `y ${String(o.wy[0]).padStart(6)}..${String(o.wy[1]).padEnd(6)} `
    + `z ${String(o.wz[0]).padStart(8)}..${String(o.wz[1]).padEnd(8)} `
    + `size ${o.size.join('x')}`);
  console.log(`         screen ${o.scr.join(',')}  rot ${o.rot.join(',')}  mat ${o.col} map=${o.map} fog=${o.fog} op=${o.op}`);
}
await b.close();
