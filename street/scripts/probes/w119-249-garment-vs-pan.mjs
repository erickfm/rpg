// Item 249 (1) — WHERE ARE THE TWO GARMENTS AGAINST THE CHAIR, IN WORLD Y?
//
// The row says the second garment is "embedded 0.03 m INSIDE the seat pan". The
// arithmetic in `ct/apartment.ts` agrees, but arithmetic is what item 146 got
// wrong (it blamed the chair; the fault was the shirt), so this MEASURES the
// built world instead: it finds the three boxes by their own BoxGeometry
// parameters — the pan is the only 0.42x0.04x0.40 in the room — and prints the
// real world AABBs and the gaps between them.
//
//   SHOT_URL=http://localhost:4750/ node scripts/probes/w119-249-garment-vs-pan.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4750/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await waitPainted(p);
await p.waitForTimeout(500);

const out = await p.evaluate(() => {
  const THREE = window.__ct.three ?? null;
  const want = [
    ['pan', 0.42, 0.04, 0.40],
    ['back', 0.42, 0.46, 0.05],
    ['shirt', 0.40, 0.22, 0.26],
    ['garment2', 0.34, 0.14, 0.22],
  ];
  const near = (a, b) => Math.abs(a - b) < 1e-4;
  const found = {};
  window.__ct.scene().traverse((o) => {
    const g = o.geometry && o.geometry.parameters;
    if (!g || g.width === undefined) return;
    for (const [name, w, h, d] of want) {
      if (!near(g.width, w) || !near(g.height, h) || !near(g.depth, d)) continue;
      o.updateWorldMatrix(true, false);
      const box = o.geometry.boundingBox ?? (o.geometry.computeBoundingBox(), o.geometry.boundingBox);
      const min = box.min.clone().applyMatrix4(o.matrixWorld);
      const max = box.max.clone().applyMatrix4(o.matrixWorld);
      const rec = {
        x: +o.position.x.toFixed(3), y: +o.position.y.toFixed(3), z: +o.position.z.toFixed(3),
        ry: +(o.rotation.y).toFixed(3),
        yBottom: +Math.min(min.y, max.y).toFixed(4), yTop: +Math.max(min.y, max.y).toFixed(4),
        dims: [g.width, g.height, g.depth],
      };
      (found[name] ??= []).push(rec);
    }
  });
  return { found, hasThree: !!THREE };
});

for (const [k, v] of Object.entries(out.found)) {
  for (const r of v) {
    console.log(`${k.padEnd(9)} y ${r.yBottom} .. ${r.yTop}   at (${r.x}, ${r.z})  ry=${r.ry}  ${r.dims.join('x')}`);
  }
}

const one = (k) => (out.found[k] ?? []).filter((r) => Math.abs(r.z - (out.found.pan?.[0]?.z ?? 0)) < 1.0)[0];
const pan = one('pan'), shirt = one('shirt'), g2 = one('garment2');
if (pan && g2) {
  const d = +(g2.yBottom - pan.yTop).toFixed(4);
  console.log(`\nsecond garment bottom ${g2.yBottom} against pan top ${pan.yTop}`);
  console.log(`  gap = ${d} m  (${d < 0 ? `EMBEDDED ${(-d).toFixed(4)} m INSIDE the pan` : d > 0.005 ? `FLOATING ${d} m` : 'resting'})`);
}
if (pan && shirt) {
  console.log(`shirt          y ${shirt.yBottom} .. ${shirt.yTop}  (it straddles the BACK, not the pan)`);
}
await b.close();
