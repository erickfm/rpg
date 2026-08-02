// H (verifier): is there a fourth, REMOVED wheel near the jacked car?
// I's row says one "leans on the wing with a pale hub". Three frames did not
// show it and a cylinder probe found only the three fitted wheels, so this
// looks at EVERY mesh near the car regardless of geometry type.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4187/';
const CAR = [26.65, 7.30];
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 800, height: 500 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct?.scene, null, { timeout: 60000 });
const out = await page.evaluate(([cx0, cz0]) => {
  const root = window.__ct.scene(); root.updateMatrixWorld(true);
  const res = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox, e = o.matrixWorld.elements, pts = [];
    for (const X of [bb.min.x, bb.max.x]) for (const Y of [bb.min.y, bb.max.y]) for (const Z of [bb.min.z, bb.max.z])
      pts.push({ x: e[0]*X + e[4]*Y + e[8]*Z + e[12], y: e[1]*X + e[5]*Y + e[9]*Z + e[13], z: e[2]*X + e[6]*Y + e[10]*Z + e[14] });
    const xs = pts.map(p=>p.x), ys = pts.map(p=>p.y), zs = pts.map(p=>p.z);
    const cx = (Math.min(...xs)+Math.max(...xs))/2, cz = (Math.min(...zs)+Math.max(...zs))/2;
    const d = Math.hypot(cx - cx0, cz - cz0);
    if (d > 3.5) return;
    res.push({ t: g.type, d: +d.toFixed(2), cx:+cx.toFixed(2), cz:+cz.toFixed(2),
               minY:+Math.min(...ys).toFixed(3), maxY:+Math.max(...ys).toFixed(3),
               w:+(Math.max(...xs)-Math.min(...xs)).toFixed(2),
               h:+(Math.max(...ys)-Math.min(...ys)).toFixed(2),
               dp:+(Math.max(...zs)-Math.min(...zs)).toFixed(2),
               col: o.material?.color ? '#'+o.material.color.getHexString() : '' });
  });
  return res;
}, CAR);
// a wheel-ish thing: roughly 0.5-0.9 m across in two dimensions
const wheelish = out.filter(m => {
  const dims = [m.w, m.h, m.dp].sort((a,b)=>b-a);
  return dims[0] >= 0.45 && dims[0] <= 1.0 && dims[1] >= 0.45 && dims[1] <= 1.0;
});
console.log(`meshes within 3.5 m of the jacked car: ${out.length}`);
console.log(`\nwheel-sized (two dims 0.45-1.0 m): ${wheelish.length}`);
for (const m of wheelish.sort((a,b)=>a.d-b.d))
  console.log(`   ${m.t.padEnd(16)} d${String(m.d).padStart(5)}  at (${m.cx},${m.cz})  y ${m.minY}..${m.maxY}  ${m.w} x ${m.h} x ${m.dp}  ${m.col}`);
console.log('\nby geometry type, everything near the car:');
const byT = {};
for (const m of out) byT[m.t] = (byT[m.t] || 0) + 1;
console.log('  ', JSON.stringify(byT));
await b.close();
