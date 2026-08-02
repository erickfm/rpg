// ARE THE CARS CLIPPING? SETTLING A CONTRADICTION, THEN LOOKING WHERE NOBODY HAS.
//
// The user, twice: *"make sure none of the cars in the lot are clipping into
// each other"*. Two builders answered with numbers that cannot both be right:
//
//   C  "closest pair 0.422 m — no car overlaps another"        (OBB/SAT)
//   H  "every neighbour overlaps by 1.23-1.70 m"               (x-extent)
//
// ── part 1: they are measuring different boxes, and I reproduce BOTH ──
//
// H's figure comes from a car's extent along the WORLD x axis:
// len*|sin y| + wid*|cos y|, against the 2.7 m row pitch. That number is real —
// it is just the width of an AXIS-ALIGNED box drawn round a raked car, and two
// cars parked in echelon overlap in that box while being nowhere near touching.
// That is what angled parking IS. C's oriented-box test is the one that answers
// the user's question.
//
// Rather than assert that, this prints both numbers for the same pair. If the
// AABB column shows an overlap and the OBB column a gap, the contradiction is
// explained and nobody has to take a side on trust.
//
// ── part 2: the gap neither of them tested ──
//
// lot-clearance.mjs only ever compares things whose `mod` is 'lot', and drops
// any fixture whose base is above 1.4 m. So two whole classes of clip are
// invisible to it:
//
//   · a car against something ANOTHER MODULE put there — the frontage, the
//     kerb, the walk-up wall. This is not hypothetical: ce8837e12 records a bay
//     coming within 1 cm of the frontage furniture after a merge widened the
//     fleet, found by hand, and nothing guards it.
//   · the tall dressing. A balloon rides at 1.85 m, above the 1.4 m cut, so a
//     balloon through a banner or through the bunting is never looked at.
//
// So part 2 takes each car as a full 3D oriented box, dressing included, and
// tests it against every solid mesh in the WORLD regardless of module or height.
//
// Usage: SHOT_URL=http://localhost:4190/ node scripts/I-clip.mjs
//        --selftest   shove a car into the frontage, require this to go red
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { flags } from './lib/args.mjs';

const ARGS = flags(['--selftest']);
const URL = aim('http://localhost:4190/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);

if (ARGS.selftest) {
  const moved = await p.evaluate(() => {
    const s = window.__ct.scene(); s.updateMatrixWorld(true);
    const roots = new Set();
    const inside = (o) => { for (let q = o.parent; q; q = q.parent) if (roots.has(q)) return true; return false; };
    let lowest = null;
    s.traverse((o) => {
      if (!o.isGroup) return;
      let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
      if (mod !== 'lot' || inside(o)) return;
      let n = 0; o.traverse((c) => { if (c.isMesh) n++; });
      if (n < 8) return;
      roots.add(o);
      if (!lowest || o.position.x < lowest.position.x) lowest = o;
    });
    if (!lowest) return 0;
    lowest.position.x -= 3.0;             // drive the street-most car into the frontage
    s.updateMatrixWorld(true);
    return 1;
  });
  console.log(`  SELFTEST: pushed ${moved} car 3 m toward the frontage — this must go red\n`);
}

const world = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const roots = new Set(), cars = [];
  const inside = (o) => { for (let q = o.parent; q; q = q.parent) if (roots.has(q)) return true; return false; };

  // A car's own-frame box, dressing and all. ONE composed transform — child
  // world matrix into the car's inverse — because applying matrixWorld and then
  // the inverse as two steps takes the AABB twice and inflates the result. My
  // first probe did exactly that and reported a car 4.47 m wide.
  const boxOf = (o) => {
    const inv = o.matrixWorld.clone().invert();
    const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    o.traverse((c) => {
      if (!c.isMesh || !c.geometry) return;
      for (let q = c; q; q = q.parent) if (q.visible === false) return;
      const g = c.geometry; if (!g.boundingBox) g.computeBoundingBox();
      if (!g.boundingBox) return;
      const bb = g.boundingBox.clone().applyMatrix4(inv.clone().multiply(c.matrixWorld));
      lo[0] = Math.min(lo[0], bb.min.x); hi[0] = Math.max(hi[0], bb.max.x);
      lo[1] = Math.min(lo[1], bb.min.y); hi[1] = Math.max(hi[1], bb.max.y);
      lo[2] = Math.min(lo[2], bb.min.z); hi[2] = Math.max(hi[2], bb.max.z);
    });
    const e = o.matrixWorld.elements;
    return {
      // the three basis vectors, straight out of the matrix, never from a yaw
      ax: [e[0], e[1], e[2]], ay: [e[4], e[5], e[6]], az: [e[8], e[9], e[10]],
      org: [e[12], e[13], e[14]],
      c: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2],
      h: [(hi[0] - lo[0]) / 2, (hi[1] - lo[1]) / 2, (hi[2] - lo[2]) / 2],
    };
  };

  const others = [];
  s.traverse((o) => {
    let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
    if (o.isGroup) {
      if (mod !== 'lot' || inside(o)) return;
      let n = 0; o.traverse((c) => { if (c.isMesh) n++; });
      if (n >= 8) { roots.add(o); cars.push({ ...boxOf(o), mod }); }
      return;
    }
    if (!o.isMesh || !o.geometry) return;
    for (let q = o; q; q = q.parent) if (q.visible === false) return;
    if (inside(o)) return;                       // a car's own parts
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
    if (!g.boundingBox) return;
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const w = bb.max.x - bb.min.x, h = bb.max.y - bb.min.y, d = bb.max.z - bb.min.z;
    // Skip only what genuinely cannot be clipped INTO: paint on the deck, and
    // the ground/road sheets a car legitimately stands on. Height is NOT a
    // filter here — that exclusion is the hole this script exists to cover.
    if (h < 0.05) return;
    if (w > 25 || d > 25) return;                // ground sheets, road, sky
    others.push({ x0: bb.min.x, y0: bb.min.y, z0: bb.min.z,
                  x1: bb.max.x, y1: bb.max.y, z1: bb.max.z, mod: mod ?? '(none)' });
  });
  return { cars, others };
});

// ── 3D SAT between an oriented box and an axis-aligned one ──
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const carPts = (c) => {
  const px = [0, 1, 2].map((i) => c.org[i] + c.ax[i] * c.c[0] + c.ay[i] * c.c[1] + c.az[i] * c.c[2]);
  const out = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1])
    out.push([0, 1, 2].map((i) => px[i] + c.ax[i] * sx * c.h[0] + c.ay[i] * sy * c.h[1] + c.az[i] * sz * c.h[2]));
  return out;
};
const boxPts = (b) => {
  const out = [];
  for (const x of [b.x0, b.x1]) for (const y of [b.y0, b.y1]) for (const z of [b.z0, b.z1]) out.push([x, y, z]);
  return out;
};
const gapAlong = (A, B, ax) => {
  const n = Math.hypot(ax[0], ax[1], ax[2]);
  if (n < 1e-9) return -1e9;                    // parallel axes carry no information
  const u = [ax[0] / n, ax[1] / n, ax[2] / n];
  const proj = (pts) => { let lo = 1e9, hi = -1e9; for (const q of pts) { const v = dot(q, u); lo = Math.min(lo, v); hi = Math.max(hi, v); } return [lo, hi]; };
  const [a0, a1] = proj(A), [b0, b1] = proj(B);
  return Math.max(b0 - a1, a0 - b1);
};
const AXES_W = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const clearance3 = (car, box) => {
  const A = carPts(car), B = boxPts(box);
  const axes = [car.ax, car.ay, car.az, ...AXES_W];
  // the nine edge-cross axes: without them SAT reports a gap between two boxes
  // that interpenetrate edge-on, which is exactly the near-miss case here
  for (const u of [car.ax, car.ay, car.az]) for (const v of AXES_W) axes.push(cross(u, v));
  let best = -1e9;
  for (const u of axes) best = Math.max(best, gapAlong(A, B, u));
  return best;
};

const { cars, others } = world;
console.log(`\n  ${cars.length} cars · ${others.length} other solid meshes in the WHOLE world\n`);

// ── part 1: the same pair, measured both ways ────────────────────────────────
console.log('  car against car — the same pairs, measured both ways:\n');
console.log('     pair                          AABB overlap      oriented-box gap');
const carW = cars.map((c) => {
  const pts = carPts(c);
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const q of pts) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[2]); z1 = Math.max(z1, q[2]); }
  return { x0, x1, z0, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 };
});
let worstPair = { d: 1e9, s: '' }, aabbHits = 0;
const FAIL = [];
for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
  // oriented gap car-to-car: SAT over both cars' axes
  const A = carPts(cars[i]), B = carPts(cars[j]);
  const axes = [cars[i].ax, cars[i].ay, cars[i].az, cars[j].ax, cars[j].ay, cars[j].az];
  let obb = -1e9;
  for (const u of axes) obb = Math.max(obb, gapAlong(A, B, u));
  const a = carW[i], b2 = carW[j];
  const aabb = Math.max(b2.x0 - a.x1, a.x0 - b2.x1, b2.z0 - a.z1, a.z0 - b2.z1);
  const near = Math.hypot(a.cx - b2.cx, a.cz - b2.cz) < 6;
  if (near) {
    if (aabb < 0) aabbHits++;
    console.log(`     (${a.cx.toFixed(1)},${a.cz.toFixed(1)}) - (${b2.cx.toFixed(1)},${b2.cz.toFixed(1)})`.padEnd(35)
      + (aabb < 0 ? `overlap ${(-aabb).toFixed(2)} m` : `clear ${aabb.toFixed(2)} m`).padEnd(20)
      + (obb < 0 ? `OVERLAP ${(-obb).toFixed(2)} m` : `clear ${obb.toFixed(2)} m`));
  }
  if (obb < worstPair.d) worstPair = { d: obb, s: `(${a.cx.toFixed(1)},${a.cz.toFixed(1)}) and (${b2.cx.toFixed(1)},${b2.cz.toFixed(1)})` };
  if (obb <= 0) FAIL.push(`cars at ${a.cx.toFixed(1)},${a.cz.toFixed(1)} and ${b2.cx.toFixed(1)},${b2.cz.toFixed(1)} OVERLAP by ${(-obb).toFixed(2)} m`);
}
console.log(`\n  ${aabbHits} neighbouring pairs overlap as AXIS-ALIGNED boxes — that is H's figure, `
  + `and it is\n  what angled parking looks like. Closest pair as ORIENTED boxes: `
  + `${worstPair.d.toFixed(3)} m, ${worstPair.s}\n`);

// ── part 2: every car against the rest of the world ──────────────────────────
let worstAny = { d: 1e9, mod: '', s: '' };
const byMod = {};
for (const c of cars) {
  const pts = carPts(c);
  let bx0 = 1e9, bx1 = -1e9, bz0 = 1e9, bz1 = -1e9;
  for (const q of pts) { bx0 = Math.min(bx0, q[0]); bx1 = Math.max(bx1, q[0]); bz0 = Math.min(bz0, q[2]); bz1 = Math.max(bz1, q[2]); }
  for (const o of others) {
    if (o.x1 < bx0 - 1 || o.x0 > bx1 + 1 || o.z1 < bz0 - 1 || o.z0 > bz1 + 1) continue;   // broad phase
    const d = clearance3(c, o);
    if (d < worstAny.d) worstAny = { d, mod: o.mod, s: `car at (${((bx0 + bx1) / 2).toFixed(1)}, ${((bz0 + bz1) / 2).toFixed(1)})` };
    if (d <= 0) {
      byMod[o.mod] = (byMod[o.mod] ?? 0) + 1;
      if (FAIL.length < 24) FAIL.push(`car at (${((bx0 + bx1) / 2).toFixed(1)}, ${((bz0 + bz1) / 2).toFixed(1)}) `
        + `INTO a '${o.mod}' mesh at (${o.x0.toFixed(1)}..${o.x1.toFixed(1)}, y ${o.y0.toFixed(2)}..${o.y1.toFixed(2)}, `
        + `${o.z0.toFixed(1)}..${o.z1.toFixed(1)}) by ${(-d).toFixed(3)} m`);
    }
  }
}
console.log(`  car against the rest of the world (every module, every height):`);
console.log(`     closest approach ${worstAny.d.toFixed(3)} m, to a '${worstAny.mod}' mesh, ${worstAny.s}`);
if (Object.keys(byMod).length) {
  console.log(`     intersections by module: ` + Object.entries(byMod).map(([m, n]) => `${m} ${n}`).join(', '));
}

if (FAIL.length) { console.log('\nFAIL'); for (const f of FAIL.slice(0, 24)) console.log('  · ' + f); }
else console.log('\nno car overlaps another car, or anything else in the world.');

await b.close();
process.exit(FAIL.length ? 1 : 0);
