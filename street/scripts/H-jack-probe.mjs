// H (verifier): where IS the jack, and how high do the wheels sit?
// The second question is the half I's row files to me (ct/cars.ts:1129).
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4187/';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 800, height: 500 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct?.scene, null, { timeout: 60000 });
const out = await page.evaluate(() => {
  const root = window.__ct.scene(); root.updateMatrixWorld(true);
  const near = [];
  const THREE_Box = (o) => {
    const g = o.geometry; if (!g) return null;
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox, m = o.matrixWorld;
    const pts = [];
    for (const X of [bb.min.x, bb.max.x]) for (const Y of [bb.min.y, bb.max.y]) for (const Z of [bb.min.z, bb.max.z]) {
      const v = { x: X, y: Y, z: Z };
      const e = m.elements;
      pts.push({
        x: e[0]*v.x + e[4]*v.y + e[8]*v.z + e[12],
        y: e[1]*v.x + e[5]*v.y + e[9]*v.z + e[13],
        z: e[2]*v.x + e[6]*v.y + e[10]*v.z + e[14],
      });
    }
    const xs = pts.map(p=>p.x), ys = pts.map(p=>p.y), zs = pts.map(p=>p.z);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys),
             maxY: Math.max(...ys), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
  };
  root.traverse((o) => {
    if (!o.isMesh) return;
    const bb = THREE_Box(o); if (!bb) return;
    const cx = (bb.minX+bb.maxX)/2, cz = (bb.minZ+bb.maxZ)/2;
    if (Math.hypot(cx - 26.18, cz - 6.28) < 3.0) {
      near.push({ name: o.name || '(unnamed)', type: o.geometry.type,
                  cx:+cx.toFixed(2), cz:+cz.toFixed(2),
                  minY:+bb.minY.toFixed(3), maxY:+bb.maxY.toFixed(3),
                  w:+(bb.maxX-bb.minX).toFixed(2), d:+(bb.maxZ-bb.minZ).toFixed(2) });
    }
  });
  // every cylinder in the whole lot = candidate wheels, with their world floor
  const wheels = [];
  root.traverse((o) => {
    if (!o.isMesh || !/Cylinder/.test(o.geometry?.type || '')) return;
    const bb = THREE_Box(o); if (!bb) return;
    const cx=(bb.minX+bb.maxX)/2, cz=(bb.minZ+bb.maxZ)/2;
    if (cx > 5 && cx < 30 && Math.abs(cz) < 15) {
      wheels.push({ cx:+cx.toFixed(2), cz:+cz.toFixed(2), minY:+bb.minY.toFixed(3),
                    h:+(bb.maxY-bb.minY).toFixed(2) });
    }
  });
  return { near, wheels, deck: window.__ct.groundAt(26.18, 6.28) };
});
console.log('deck ground at the jacked car:', out.deck.toFixed(3));
console.log(`\nmeshes within 3 m of the published jack position (26.18, 6.28): ${out.near.length}`);
for (const m of out.near.sort((a,b)=>a.minY-b.minY).slice(0, 22))
  console.log(`   ${m.type.padEnd(16)} at (${String(m.cx).padStart(6)},${String(m.cz).padStart(6)})  y ${String(m.minY).padStart(7)}..${String(m.maxY).padStart(6)}  ${m.w}x${m.d}`);
const low = out.wheels.filter(w => w.minY < 0.30).sort((a,b)=>a.minY-b.minY);
console.log(`\nlot cylinders with a floor under 0.30 (candidate wheels): ${low.length}`);
const byY = {};
for (const w of low) { const k = w.minY.toFixed(3); (byY[k] ??= []).push(w); }
for (const [y, ws] of Object.entries(byY).sort()) console.log(`   floor y ${y}: ${ws.length} wheels`);
await b.close();
