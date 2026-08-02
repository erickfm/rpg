// ITEM 97 — "a black vertical bar floats over the left edge of the facade".
//
// The bar is unlabelled in a scene of 3000+ unnamed objects, so it is found by
// SIGNATURE, not by memory: tall (>6 m), thin (<0.6 m in x), standing in front
// of the SEVENS facade plane (z between -96 and -93), inside the casino's own
// frontage in x. Everything matching is printed with its material so the source
// line that built it can be identified.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4180/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1160, height: 819 } });
p.on('console', (m) => { if (m.type() === 'error') console.log('  console error:', m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(2000);

const r = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const out = [];
  s.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    for (let q = o; q; q = q.parent) if (q.visible === false) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); if (!g.boundingBox) return;
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const w = bb.max.x - bb.min.x, h = bb.max.y - bb.min.y, d = bb.max.z - bb.min.z;
    // the casino frontage, in front of the facade plane, tall and thin
    if (bb.max.x < 44 || bb.min.x > 58) return;
    if (bb.max.z < -96.5 || bb.min.z > -92.5) return;
    if (h < 5) return;
    if (Math.min(w, d) > 1.2) return;
    const mats = (Array.isArray(o.material) ? o.material : [o.material]).filter(Boolean);
    out.push({
      type: g.type,
      x: [+bb.min.x.toFixed(2), +bb.max.x.toFixed(2)],
      y: [+bb.min.y.toFixed(2), +bb.max.y.toFixed(2)],
      z: [+bb.min.z.toFixed(2), +bb.max.z.toFixed(2)],
      size: [+w.toFixed(2), +h.toFixed(2), +d.toFixed(2)],
      ry: +o.rotation.y.toFixed(3),
      mat: mats.map((m) => ({
        col: '#' + (m.color ? m.color.getHexString() : '??'),
        map: m.map && m.map.image ? `${m.map.image.width}x${m.map.image.height}` : null,
        tr: !!m.transparent, op: m.opacity, fog: m.fog,
      })),
    });
  });
  return out.sort((a, c) => c.y[1] - a.y[1]);
});
console.log(`tall thin objects standing off the SEVENS/ORPHEUS facade: ${r.length}\n`);
for (const o of r) {
  console.log(`${o.type.padEnd(16)} x ${String(o.x[0]).padStart(7)}..${String(o.x[1]).padEnd(7)} `
    + `y ${String(o.y[0]).padStart(6)}..${String(o.y[1]).padEnd(6)} `
    + `z ${String(o.z[0]).padStart(7)}..${String(o.z[1]).padEnd(7)} `
    + `wxhxd ${o.size.join(' x ')}  ry=${o.ry}`);
  for (const m of o.mat) console.log(`    mat ${m.col} map=${m.map ?? '-'} transparent=${m.tr} opacity=${m.op} fog=${m.fog}`);
}
await b.close();
