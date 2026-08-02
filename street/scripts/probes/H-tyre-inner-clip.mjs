// H: "the inner clipping of the tires in the pickup was never fixed" — the
// user's words, and he says it has been reported before.
//
// My earlier silhouette check proved nothing sits OUTSIDE the tyre. It never
// asked the opposite question: does the tyre reach INBOARD through the body's
// own side wall, so you see tyre inside the cab or the bed? Measured in each
// car's OWN frame, so yaw cannot smear it.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const URL = aim('http://localhost:4187/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
p.on('pageerror', (e) => console.log('  PAGE ERROR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.scene, null, { timeout: 60000 });
console.log(`measuring ${URL}  build ${await p.evaluate(() => document.body.innerText.match(/[0-9a-f]{9}/)?.[0] ?? '?')}`);
const cars = await p.evaluate(() => {
  const root = window.__ct.scene(); root.updateMatrixWorld(true);
  const out = [];
  root.traverse((g) => {
    if (!g.userData || !g.userData.wheelbase) return;
    const inv = g.matrixWorld.clone().invert();
    const parts = [];
    g.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      const q = o.geometry; if (!q.boundingBox) q.computeBoundingBox();
      const bb = q.boundingBox;
      const m = o.matrixWorld.clone().premultiply(inv).elements;
      const xs = [], ys = [], zs = [];
      for (const X of [bb.min.x, bb.max.x]) for (const Y of [bb.min.y, bb.max.y]) for (const Z of [bb.min.z, bb.max.z]) {
        xs.push(m[0]*X + m[4]*Y + m[8]*Z + m[12]);
        ys.push(m[1]*X + m[5]*Y + m[9]*Z + m[13]);
        zs.push(m[2]*X + m[6]*Y + m[10]*Z + m[14]);
      }
      parts.push({ type: q.type,
        x0: Math.min(...xs), x1: Math.max(...xs),
        y0: Math.min(...ys), y1: Math.max(...ys),
        z0: Math.min(...zs), z1: Math.max(...zs) });
    });
    out.push({ wb: g.userData.wheelbase, at: [+g.matrixWorld.elements[12].toFixed(1), +g.matrixWorld.elements[14].toFixed(1)], parts });
  });
  return out;
});
console.log(`\n${cars.length} vehicles. For each: the tyre's INBOARD face against the body's side wall.\n`);
let bad = 0;
for (const c of cars) {
  const tyres = c.parts.filter((q) => /Cylinder/.test(q.type)
    && Math.abs(q.x1 - q.x0) > 0.1 && (q.y1 - q.y0) > 0.5 && (q.y1 - q.y0) < 0.95 && q.y0 < 0.4);
  if (!tyres.length) continue;
  // the body shell: tall parts, which a tyre is not
  const shell = c.parts.filter((q) => !tyres.includes(q) && q.y1 >= 0.75);
  const shellHW = Math.max(0, ...shell.map((q) => Math.max(Math.abs(q.x0), Math.abs(q.x1))));
  const worst = [];
  for (const t of tyres) {
    const outer = t.x1 > 0 ? t.x1 : -t.x0;          // outboard face
    const inner = t.x1 > 0 ? t.x0 : -t.x1;          // inboard face, same sign convention
    // which shell parts does this tyre's inboard half actually pass through?
    const hit = shell.filter((q) =>
      t.x0 < q.x1 && t.x1 > q.x0 && t.y0 < q.y1 && t.y1 > q.y0 && t.z0 < q.z1 && t.z1 > q.z0);
    const depth = hit.length ? Math.max(...hit.map((q) => Math.min(t.x1, q.x1) - Math.max(t.x0, q.x0))) : 0;
    worst.push({ outer: +outer.toFixed(3), inner: +inner.toFixed(3), hits: hit.length, depth: +depth.toFixed(3) });
  }
  const w = worst.reduce((a, x) => (x.depth > a.depth ? x : a), worst[0]);
  const flag = w.depth > 0.005;
  if (flag) bad++;
  console.log(`  wb ${String(c.wb).padEnd(4)} at (${String(c.at[0]).padStart(6)},${String(c.at[1]).padStart(7)})  ${tyres.length} tyres  shell half-width ${shellHW.toFixed(3)}` +
              `  worst tyre: outer ${w.outer} inner ${w.inner}  overlaps ${w.hits} shell part(s) by ${w.depth} m${flag ? '   <-- INNER CLIP' : ''}`);
}
console.log(`\n${bad} of ${cars.length} vehicles have a tyre intersecting the body shell.`);
await b.close();
process.exit(bad ? 1 : 0);
