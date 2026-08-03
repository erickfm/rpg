// ITEM 141: WHOSE geometry is in the frustum at each station?
//
// `ct/interior.ts:38-45` states the world's address map in prose: "x < 100 is
// the street. 100-230 is the walk-up, 230-260 the old bodega room ... New
// interiors start at 400 and take a 80 m slab each." Those bands are read from
// that comment and from `interiorMaxX()`; they are NOT a guess about geometry.
//
// This buckets every frustum-visible renderable by the band its world centre
// falls in, so "the exterior draws through the window" becomes a number with a
// name on it rather than a theory.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w53-bands.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4183/');
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(13, 30));

const win = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  let best = null;
  s.traverse((n) => {
    if (!n.isMesh || n.geometry?.type !== 'PlaneGeometry') return;
    const gp = n.geometry.parameters;
    if (Math.abs(gp.width - 1.3) > 0.01 || Math.abs(gp.height - 1.3) > 0.01) return;
    const e = n.matrixWorld.elements;
    if (e[13] < 5 || e[13] > 9) return;
    if (!best || e[13] > best.y) best = { x: e[12], y: e[13], z: e[14] };
  });
  return best;
});
const spawn = await p.evaluate(() => window.__ct.pos());

const STATIONS = [
  ['301 FACING THE WINDOW', [win.x + 2.4, win.z, -Math.PI / 2, spawn[3]]],
  ['301 facing away',       [win.x + 2.4, win.z,  Math.PI / 2, spawn[3]]],
  ['the street',            [0, 0, 0, 0]],
];

for (const [name, warp] of STATIONS) {
  await p.evaluate(([x, z, yaw, gy]) => window.__ct.warp(x, z, yaw, gy, 0), warp);
  await p.waitForTimeout(1200);
  const r = await p.evaluate(() => {
    const s = window.__ct.scene(), cam = window.__ct.camera();
    s.updateMatrixWorld(true); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
    const m = cam.projectionMatrix.clone().multiply(cam.matrixWorldInverse).elements;
    const pl = [
      [m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12]],
      [m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12]],
      [m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13]],
      [m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13]],
      [m[3] - m[2], m[7] - m[6], m[11] - m[10], m[15] - m[14]],
      [m[3] + m[2], m[7] + m[6], m[11] + m[10], m[15] + m[14]],
    ].map(([a, b, c, d]) => { const n = Math.hypot(a, b, c); return [a / n, b / n, c / n, d / n]; });
    const hidden = (o) => { for (let q = o; q; q = q.parent) if (!q.visible) return true; return false; };
    const band = (x) => (x < 100 ? 'street  (x<100)'
      : x < 230 ? 'walk-up (100-230)'
      : x < 260 ? 'bodega  (230-260)'
      : x < 400 ? 'dead    (260-400)'
      : 'belt    (400+)');
    const out = new Map(); let drawn = 0;
    const cams = cam.position;
    let farthest = 0;
    s.traverse((o) => {
      if (!o.isMesh && !o.isPoints && !o.isLine && !o.isSprite) return;
      if (hidden(o)) return;
      const g = o.geometry;
      if (g && !g.boundingSphere) g.computeBoundingSphere();
      const bs = g?.boundingSphere;
      let inF = true, cx = o.matrixWorld.elements[12];
      if (bs) {
        const c = bs.center.clone().applyMatrix4(o.matrixWorld);
        const el = o.matrixWorld.elements;
        const sc = Math.max(Math.hypot(el[0], el[1], el[2]), Math.hypot(el[4], el[5], el[6]), Math.hypot(el[8], el[9], el[10]));
        const r = bs.radius * sc;
        cx = c.x;
        for (const [a, b2, c2, d] of pl) if (a * c.x + b2 * c.y + c2 * c.z + d < -r) { inF = false; break; }
        if (inF) farthest = Math.max(farthest, c.distanceTo(cams));
      }
      if (o.frustumCulled === false) inF = true;
      if (!inF) return;
      drawn++;
      const k = band(cx);
      out.set(k, (out.get(k) ?? 0) + 1);
    });
    return { drawn, rows: [...out.entries()].sort(), farthest, cam: [cams.x, cams.y, cams.z] };
  });
  console.log(`\n=== ${name} ===  eye (${r.cam[0].toFixed(1)}, ${r.cam[1].toFixed(1)}, ${r.cam[2].toFixed(1)})`);
  console.log(`    frustum-visible renderables: ${r.drawn}   farthest ${r.farthest.toFixed(0)} m`);
  for (const [k, n] of r.rows) console.log(`      ${String(n).padStart(5)}  ${k}`);
}
await browser.close();
