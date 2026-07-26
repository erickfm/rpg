// DO WHEEL ARCHES READ AS ARCHES? Third attempt at a row two people could not
// settle, and the two failures are the whole design of this one.
//
//   the ORIGINAL check compared a WORLD-SPACE tyre top against a CAR-LOCAL arch
//     line — two frames, so no value of either could ever decide it. The
//     auditor caught that: "CANNOT ANSWER".
//   F then FIXED THE FRAME and it still could not decide, because the
//     POPULATION was wrong: any cylinder of radius 0.18-0.42 below 1.2 m counts,
//     and a diner bar stool is a cylinder of radius 0.19. 328 "tyres" against
//     the auditor's 86, and most of the "bare" ones were stools with no car
//     above them — which is correct for a stool.
//
// So the fix is neither the frame nor the threshold: it is that A TYRE IS PART
// OF A CAR. Cars are groups carrying `userData.steer`; a tyre is a cylinder
// INSIDE one. Nothing outside a car can enter the population, so no stool, no
// bin, no lamp base, and no future round prop can ever be counted again.
//
// Then the test is F's, which is the right test and physically what an arch IS:
// for each tyre, is there body geometry from THE SAME CAR directly above it,
// whose underside sits below the top of the tyre? Same car means same frame,
// so the auditor's objection cannot come back either.
//
//   node scripts/A-wheel-arches.mjs [port]
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const ARG = process.argv[2];
const URL = process.env.SHOT_URL
  ?? (ARG && /^\d+$/.test(ARG) ? `http://localhost:${ARG}/` : ARG)
  ?? 'http://localhost:4188/';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(2500);
await reportWorld(p, URL);

const r = await p.evaluate(() => {
  const box = (o) => {
    o.updateWorldMatrix(true, false);
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox, e = o.matrixWorld.elements;
    let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (const X of [bb.min.x, bb.max.x]) for (const Y of [bb.min.y, bb.max.y]) for (const Z of [bb.min.z, bb.max.z]) {
      const wx = e[0]*X + e[4]*Y + e[8]*Z + e[12];
      const wy = e[1]*X + e[5]*Y + e[9]*Z + e[13];
      const wz = e[2]*X + e[6]*Y + e[10]*Z + e[14];
      lo = [Math.min(lo[0],wx), Math.min(lo[1],wy), Math.min(lo[2],wz)];
      hi = [Math.max(hi[0],wx), Math.max(hi[1],wy), Math.max(hi[2],wz)];
    }
    return { lo, hi };
  };

  const cars = [];
  window.__ct.scene().traverse((o) => {
    if (o.type === 'Group' && o.userData && o.userData.steer !== undefined) cars.push(o);
  });

  const out = [];
  for (const car of cars) {
    const tyres = [], body = [];
    car.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      const g = o.geometry;
      if (g.type === 'CylinderGeometry') {
        const rr = Math.max(g.parameters.radiusTop ?? 0, g.parameters.radiusBottom ?? 0);
        if (rr >= 0.15 && rr <= 0.45) { tyres.push(box(o)); return; }
      }
      body.push(box(o));
    });
    for (const t of tyres) {
      // body from THE SAME CAR overlapping this tyre in plan, whose underside
      // is below the tyre's top — that is an arch over a wheel.
      let best = null;
      for (const m of body) {
        if (m.hi[0] < t.lo[0] || m.lo[0] > t.hi[0]) continue;
        if (m.hi[2] < t.lo[2] || m.lo[2] > t.hi[2]) continue;
        if (m.hi[1] < t.lo[1]) continue;                 // entirely under the tyre
        if (best === null || m.lo[1] < best) best = m.lo[1];
      }
      out.push({ top: +t.hi[1].toFixed(3), archUnder: best === null ? null : +best.toFixed(3),
                 over: best !== null && best < t.hi[1] });
    }
  }
  return { cars: cars.length, tyres: out.length,
           arched: out.filter((q) => q.over).length,
           bare: out.filter((q) => !q.over).map((q) => ({ top: q.top, archUnder: q.archUnder })).slice(0, 8) };
});

console.log(`\n${r.cars} cars · ${r.tyres} tyres (only cylinders INSIDE a car group)`);
console.log(`  tyres with same-car body overhanging them: ${r.arched}`);
console.log(`  bare:                                      ${r.tyres - r.arched}`);
for (const q of r.bare) console.log(`     tyre top ${q.top}  nearest body underside ${q.archUnder ?? 'none above it'}`);
await b.close();
if (!r.cars || !r.tyres) {
  console.error(`\nCANNOT ANSWER — no cars or no tyres found; nothing was measured.`);
  process.exit(3);                                       // GOTCHAS 32/34
}
if (r.arched < r.tyres) {
  console.error(`\nMEASURED WRONG — ${r.tyres - r.arched} tyre(s) have no bodywork over them.`);
  process.exit(1);
}
console.log(`\nMEASURED FINE — every tyre on every car has its own car's body arching over it.`);
