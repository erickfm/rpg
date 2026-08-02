// H: true wheel clearance — each wheel against the ground UNDER IT, not against
// one sampled deck height. Assuming a uniform deck is how 36 sound wheels would
// read as floating.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const URL = aim('http://localhost:4187/');
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 800, height: 500 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct?.scene, null, { timeout: 60000 });
let rows = await page.evaluate(() => {
  const root = window.__ct.scene(); root.updateMatrixWorld(true);
  const out = [];
  root.traverse((o) => {
    if (!o.isMesh || !/Cylinder/.test(o.geometry?.type || '')) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox, e = o.matrixWorld.elements, pts = [];
    for (const X of [bb.min.x, bb.max.x]) for (const Y of [bb.min.y, bb.max.y]) for (const Z of [bb.min.z, bb.max.z])
      pts.push({ x: e[0]*X+e[4]*Y+e[8]*Z+e[12], y: e[1]*X+e[5]*Y+e[9]*Z+e[13], z: e[2]*X+e[6]*Y+e[10]*Z+e[14] });
    const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y), zs=pts.map(p=>p.z);
    const w=Math.max(...xs)-Math.min(...xs), h=Math.max(...ys)-Math.min(...ys), d=Math.max(...zs)-Math.min(...zs);
    // a road wheel: ~0.6-0.8 across in two dims
    const dim=[w,h,d].sort((a,b)=>b-a);
    if (dim[0] < 0.55 || dim[0] > 0.95 || dim[1] < 0.55) return;
    const cx=(Math.min(...xs)+Math.max(...xs))/2, cz=(Math.min(...zs)+Math.max(...zs))/2;
    out.push({ cx:+cx.toFixed(2), cz:+cz.toFixed(2), floor:+Math.min(...ys).toFixed(3),
               gy:+window.__ct.groundAt(cx, cz).toFixed(3) });
  });
  return out;
});
for (const r of rows) r.gap = +(r.floor - r.gy).toFixed(3);
// The block only. Cylinders at x 600-1080 are off-world prefab/staging copies,
// not parked cars, and they swamped the histogram on my first run.
const rowsAll = rows;
rows = rows.filter(r => Math.abs(r.cx) < 100 && Math.abs(r.cz) < 200);
const lot = rows.filter(r => r.cx > 5 && r.cx < 30 && Math.abs(r.cz) < 15);
console.log(`${rowsAll.length} wheel-sized cylinders, ${rows.length} on the block, ${lot.length} in the lot\n`);
const hist = {};
for (const r of rows) { const k = r.gap.toFixed(3); (hist[k] ??= []).push(r); }
console.log('CLEARANCE (wheel floor minus ground under it), on the block:');
for (const [g, rs] of Object.entries(hist).sort((a,b)=>+a[0]-+b[0]))
  console.log(`   gap ${String(g).padStart(7)} m : ${String(rs.length).padStart(3)} wheels   e.g. (${rs[0].cx}, ${rs[0].cz})`);
const bad = rows.filter(r => r.gap > 0.020).sort((a,b)=>b.gap-a.gap);
console.log(`\nwheels more than 20 mm off the ground: ${bad.length}`);
for (const r of bad.slice(0,10)) console.log(`   (${r.cx}, ${r.cz})  floor ${r.floor}  ground ${r.gy}  gap ${r.gap}`);
await b.close();
