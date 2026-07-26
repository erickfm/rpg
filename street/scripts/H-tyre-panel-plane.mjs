// H: "inner clipping" precisely — is any thin flank PANEL positioned INSIDE the
// tyre's own x-span, so the panel plane cuts through the tyre? That is the
// coplanar/intersecting case (GOTCHAS §6), and it is what you would see as tyre
// through bodywork. A body BOUNDING BOX overlapping the wheel is not that: a
// wheel is meant to sit inside the car's footprint, which is why my first
// bbox test flagged 22 of 23 and meant nothing.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4187/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.scene, null, { timeout: 60000 });
const res = await p.evaluate(() => {
  const root = window.__ct.scene(); root.updateMatrixWorld(true);
  const cars = [];
  root.traverse((g) => {
    if (!g.userData || !g.userData.wheelbase) return;
    if (Math.abs(g.userData.wheelbase - 3.3) > 0.01) return;      // pickups
    const inv = g.matrixWorld.clone().invert();
    const parts = [];
    g.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      const q = o.geometry; if (!q.boundingBox) q.computeBoundingBox();
      const bb = q.boundingBox, m = o.matrixWorld.clone().premultiply(inv).elements;
      const xs=[],ys=[],zs=[];
      for (const X of [bb.min.x,bb.max.x]) for (const Y of [bb.min.y,bb.max.y]) for (const Z of [bb.min.z,bb.max.z]) {
        xs.push(m[0]*X+m[4]*Y+m[8]*Z+m[12]); ys.push(m[1]*X+m[5]*Y+m[9]*Z+m[13]); zs.push(m[2]*X+m[6]*Y+m[10]*Z+m[14]);
      }
      parts.push({ t:q.type, x0:Math.min(...xs), x1:Math.max(...xs),
                   y0:Math.min(...ys), y1:Math.max(...ys), z0:Math.min(...zs), z1:Math.max(...zs) });
    });
    const e=g.matrixWorld.elements;
    cars.push({ at:[+e[12].toFixed(1),+e[14].toFixed(1)], parts });
  });
  return cars;
});
console.log(`${res.length} pickups\n`);
let bad=0;
for (const c of res) {
  const tyres = c.parts.filter(q => /Cylinder/.test(q.t) && (q.y1-q.y0)>0.5 && (q.y1-q.y0)<0.95 && q.y0<0.4);
  // a PANEL: thin in x (a skin, not a solid), tall enough to be bodywork
  const panels = c.parts.filter(q => !tyres.includes(q) && (q.x1-q.x0) < 0.12 && (q.y1-q.y0) > 0.15);
  const hits = [];
  for (const t of tyres) {
    const lo = Math.min(Math.abs(t.x0), Math.abs(t.x1)), hi = Math.max(Math.abs(t.x0), Math.abs(t.x1));
    for (const q of panels) {
      const px = (Math.abs(q.x0)+Math.abs(q.x1))/2;
      const sameSide = Math.sign(q.x0+q.x1) === Math.sign(t.x0+t.x1);
      // the panel plane strictly INSIDE the tyre's span, overlapping in y and z
      if (!sameSide || px <= lo + 0.005 || px >= hi - 0.005) continue;
      if (t.y0 >= q.y1 || t.y1 <= q.y0 || t.z0 >= q.z1 || t.z1 <= q.z0) continue;
      hits.push({ px:+px.toFixed(3), tyre:`${lo.toFixed(2)}..${hi.toFixed(2)}`, y:`${q.y0.toFixed(2)}..${q.y1.toFixed(2)}` });
    }
  }
  if (hits.length) bad++;
  console.log(`  pickup at (${c.at})  ${tyres.length} tyres, ${panels.length} thin panels  ->  ${hits.length ? 'PANEL PLANE INSIDE A TYRE: '+JSON.stringify(hits.slice(0,3)) : 'no panel plane cuts a tyre'}`);
}
console.log(`\n${bad} of ${res.length} pickups have a panel plane cutting through a tyre.`);
await b.close();
process.exit(bad ? 1 : 0);
