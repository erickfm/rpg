// DO THE WHEEL ARCHES READ AS ARCHES? — deciding a row nothing could decide.
//
// F moved *"wheel arches read as arches"* back from CONFIRMED and said why, in
// two layers:
//
//   1. the ORIGINAL check compared a WORLD-SPACE tyre top against a CAR-LOCAL
//      arch line — two frames, so no value of either could ever settle it;
//   2. F's replacement fixed the frame and still could not decide, because the
//      POPULATION was wrong: it selected "any cylinder of radius 0.18–0.42
//      below 1.2 m", and **a diner bar stool is a cylinder of radius 0.19**.
//      It found 328 tyres where the auditor counts 86, and most of its 116
//      "bare tyres" were stools with no car above them — correct, for a stool.
//
// F is right that a tag would settle it. `ct/cars.ts` is H's and I cannot tag
// it. But the population problem does not need a tag: **a tyre is a cylinder
// INSIDE A CAR, and a bar stool is not.** That is the same discriminator
// `I-clip`, `I-rows` and `I-cards` already rely on — the outermost group under a
// module with enough meshes to be a vehicle — and it cannot admit furniture,
// because furniture is not parented to a car.
//
// F's physical definition is kept exactly, because it is the right one: for each
// tyre, is there body geometry directly above it whose BOTTOM sits below the
// tyre's TOP? That is what an arch IS. Everything is done in the CAR's own frame
// so a raked or tilted vehicle cannot smear the comparison — the mistake layer 1
// made.
//
// Usage: SHOT_URL=http://127.0.0.1:4194/ node scripts/I-archcheck.mjs
//        --selftest   flatten every arch, require this to go red
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { flags } from './lib/args.mjs';

const ARGS = flags(['--selftest']);
const URL = process.env.SHOT_URL ?? 'http://127.0.0.1:4194/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);

if (ARGS.selftest) {
  // Raise every body panel clear of every tyre: the arches stop being arches.
  const n = await p.evaluate(() => {
    const s = window.__ct.scene(); s.updateMatrixWorld(true);
    let moved = 0;
    const roots = new Set();
    const inside = (o) => { for (let q = o.parent; q; q = q.parent) if (roots.has(q)) return true; return false; };
    s.traverse((o) => {
      if (!o.isGroup || inside(o)) return;
      let w = 0; o.traverse((c) => {
        const g = c.isMesh && c.geometry?.type === 'CylinderGeometry' && c.geometry.parameters;
        if (g && g.radiusTop > 0.18 && g.radiusTop < 0.45 && g.height < 0.45) w++;
      });
      if (w < 3) return;
      roots.add(o);
      o.traverse((c) => {
        if (!c.isMesh || c.geometry?.type === 'CylinderGeometry') return;
        c.position.y += 0.5; moved++;
      });
    });
    s.updateMatrixWorld(true);
    return moved;
  });
  console.log(`  SELFTEST: lifted ${n} body panels 0.5 m clear of their tyres — this must go red\n`);
}

const res = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const roots = new Set();
  const inside = (o) => { for (let q = o.parent; q; q = q.parent) if (roots.has(q)) return true; return false; };

  // A CAR IS A GROUP WITH WHEELS ON IT. Not "a cylinder of about this radius" —
  // that is what admitted the bar stools. Three or more wheel-shaped cylinders
  // under one outermost group is a vehicle and nothing else in this world is.
  const cars = [];
  s.traverse((o) => {
    if (!o.isGroup || inside(o)) return;
    let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
    const wheels = [];
    o.traverse((c) => {
      if (!c.isMesh || c.geometry?.type !== 'CylinderGeometry') return;
      const g = c.geometry.parameters;
      if (!g || !(g.radiusTop > 0.18 && g.radiusTop < 0.45 && g.height < 0.45)) return;
      wheels.push(c);
    });
    if (wheels.length < 3) return;
    // ONE WHEEL IS SEVERAL CYLINDERS -- tyre, rim, hub cap are all cylinders of
    // about the same radius at the same place. Counting them raw gave 359
    // "tyres" on 27 vehicles, about thirteen a car, and publishing that would
    // have been F's population fault again one layer further down. Cluster by
    // position: cylinders whose centres are within 0.15 m are the same wheel,
    // and the largest of them is the tyre.
    const byPlace = [];
    for (const c of wheels) {
      const e = c.matrixWorld.elements;
      const hit = byPlace.find((g2) => Math.hypot(g2.x - e[12], g2.y - e[13], g2.z - e[14]) < 0.15);
      if (hit) { hit.parts.push(c); continue; }
      byPlace.push({ x: e[12], y: e[13], z: e[14], parts: [c] });
    }
    const tyres = byPlace.map((g2) =>
      g2.parts.reduce((a, c) => (c.geometry.parameters.radiusTop > a.geometry.parameters.radiusTop ? c : a), g2.parts[0]));
    // AND THE WHEELS MUST FIT ON A CAR. "A group with 3+ wheel-shaped cylinders"
    // is NOT a vehicle test: a diner is a group and its bar stools are cylinders
    // of radius 0.19, so the room itself classified as a car and brought all its
    // stools in as tyres. That is F's own bug promoted one level, and it showed
    // as 27 "vehicles" carrying 355 "tyres" -- thirteen a car, which no car has.
    // A car carries 3-6 wheels inside a footprint of about 3 x 6 m; a room's
    // furniture is spread over ten metres and there is a lot of it.
    if (tyres.length < 3 || tyres.length > 6) return;
    // IN THE CAR'S OWN FRAME, not world axes. Measuring the wheel footprint in
    // world x/z inflates it for any raked car -- the lot parks herringbone at
    // 0.55 rad and its back corners at 1.15 -- so three of the lot's own cars
    // failed a 3.0 m width test that their actual track passes easily. That is
    // the axis-aligned-versus-oriented mistake for the fourth time this session,
    // and it is exactly the class of error this row exists to stamp out.
    const invW = o.matrixWorld.clone().invert();
    let wx0 = 1e9, wx1 = -1e9, wz0 = 1e9, wz1 = -1e9;
    for (const t of tyres) {
      const e = t.matrixWorld.clone().premultiply(invW).elements;
      wx0 = Math.min(wx0, e[12]); wx1 = Math.max(wx1, e[12]);
      wz0 = Math.min(wz0, e[14]); wz1 = Math.max(wz1, e[14]);
    }
    const spanA = Math.max(wx1 - wx0, wz1 - wz0), spanB = Math.min(wx1 - wx0, wz1 - wz0);
    if (spanA > 6.5 || spanB > 3.0) return;
    roots.add(o); cars.push({ o, wheels, tyres, mod });
  });

  const out = { cars: cars.length, byMod: {}, tyres: 0, arched: 0, bare: [], drops: [] };
  for (const car of cars) {
    out.byMod[car.mod ?? '(none)'] = (out.byMod[car.mod ?? '(none)'] ?? 0) + 1;
    const inv = car.o.matrixWorld.clone().invert();
    const local = (m) => {
      m.geometry.computeBoundingBox();
      return m.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(m.matrixWorld));
    };
    // every solid body piece of THIS car, in THIS car's frame
    const body = [];
    car.o.traverse((c) => {
      if (!c.isMesh || !c.geometry) return;
      if (car.wheels.includes(c)) return;
      if (c.geometry.type === 'PlaneGeometry') return;      // decals and cards are not bodywork
      const bb = local(c);
      const th = Math.min(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z);
      if (th < 0.03) return;
      body.push(bb);
    });
    for (const w of car.tyres) {
      out.tyres++;
      const t = local(w);
      // F's definition, kept: is there body directly ABOVE this tyre whose
      // BOTTOM sits below the tyre's TOP? Overlap is tested in plan (x,z) so
      // "directly above" means what it says.
      let best = null;
      for (const q of body) {
        const ox = Math.min(t.max.x, q.max.x) - Math.max(t.min.x, q.min.x);
        const oz = Math.min(t.max.z, q.max.z) - Math.max(t.min.z, q.min.z);
        if (ox <= 0.02 || oz <= 0.02) continue;             // not over the tyre
        if (q.min.y >= t.max.y) continue;                    // sits entirely above the tyre top
        const drop = t.max.y - q.min.y;                      // how far the arch comes down past it
        if (!best || drop > best) best = drop;
      }
      if (best !== null) { out.arched++; out.drops.push(+best.toFixed(3)); }
      else out.bare.push({ mod: car.mod, y: +t.max.y.toFixed(3) });
    }
  }
  return out;
});

console.log(`\n  ${res.cars} vehicles found by "a group with 3+ wheels on it"`);
console.log(`  by module: ` + Object.entries(res.byMod).map(([k, v]) => `${k} ${v}`).join(', '));
console.log(`\n  ${res.tyres} tyres, ${res.arched} with body over them, ${res.bare.length} bare\n`);
if (res.drops.length) {
  const d = res.drops.slice().sort((a, b2) => a - b2);
  const q = (f) => d[Math.min(d.length - 1, Math.floor(f * d.length))];
  // HOW FAR the bodywork comes down past the top of the tyre. "Something is
  // over it" and "it reads as an arch" are different claims and this is the
  // second one -- the row's original evidence was a single +0.057 m.
  console.log(`  arch depth past the tyre top:  min ${d[0]}  median ${q(0.5)}  max ${d[d.length - 1]} m`);
  console.log(`  tyres with under 20 mm of arch: ${d.filter((v) => v < 0.02).length}\n`);
}
if (res.bare.length) {
  const by = {};
  for (const q of res.bare) by[q.mod ?? '(none)'] = (by[q.mod ?? '(none)'] ?? 0) + 1;
  console.log('  BARE TYRES — no bodywork comes down past the top of these:');
  for (const [k, v] of Object.entries(by)) console.log(`     ${String(v).padStart(3)} on '${k}' vehicles`);
  console.log('\nFAIL  a tyre with nothing over it is a wheel in a wheel-well that is not there.');
} else {
  console.log('every tyre on every vehicle has bodywork coming down past its top — the arches are arches.');
}
await b.close();
process.exit(res.bare.length ? 1 : 0);
