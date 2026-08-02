// DO THE CARS CLIP EACH OTHER, OR THE FURNITURE?
//
// The user: *"make sure none of the cars in the lot are clipping into each
// other ... Check every pair: box against box, at their real dimensions, not
// their centre spacing. Report the minimum clearance you find."* And the two
// reasons it is likelier than it looks: *"the fleet is MIXED - a pickup,
// sedans and a van are not the same length or width, so a spacing that works
// for two sedans will overlap a pickup and its neighbour"*, and the rows had
// just been rotated 180°, *"which changes which end of each car is where and
// can turn a clearance into an overlap."*
//
// ── why this is an OBB test and not a box test ──
//
// The stock is herringboned — every car is raked off-axis — so a world
// axis-aligned box around a raked 4.5 m car is far bigger than the car. On
// this lot an AABB test reports overlaps between cars that are 40 cm apart,
// which is worse than useless: it would send someone widening a spacing that
// is correct, and the real overlap would still be there afterwards.
//
// So each car is measured as an ORIENTED box — its extents in its OWN frame,
// its position and yaw out of its world matrix — and pairs are separated by
// SAT on the four candidate axes. Clearance is the smallest gap along any
// separating axis, which for two convex boxes IS the distance between them.
//
// ── extents come from the built geometry, deliberately ──
//
// The user offered H's true dimensions: *"Builder H owns the car models and
// knows their true extents; ask me if you need them rather than assuming from
// the mesh."* I have not needed to ask, and the distinction matters: this does
// not ASSUME a size, it measures the union of every child mesh's bounding box
// transformed into the car's own frame. That is the body that is actually in
// the world, which is the thing that can clip. A nominal dimension from H
// would be the right answer to a different question — and if these two ever
// disagree, that gap is itself the finding.
//
// Usage: SHOT_URL=http://localhost:4190/ node scripts/lot-clearance.mjs
//        --selftest   shove one car into its neighbour, require this to go red
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { flags } from './lib/args.mjs';

const ARGS = flags(['--selftest']);   // unknown flags exit 2, not silently ignored
const SELFTEST = ARGS.selftest;
const URL = aim('http://localhost:4177/');
// Real lots park tight — the user: *"30 to 60 cm between cars is authentic and
// looks right - so the target is not generous spacing, it is NO OVERLAP with a
// small honest gap."* So the bar is overlap, and the gap is REPORTED rather
// than asserted: failing a lot for parking at 25 cm would be inventing a rule
// nobody asked for.
const TOUCH = 0.0;          // anything below this is a clip
const SNUG = 0.30;          // below this is reported as tight, not failed

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
const errors = [];
p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);

if (SELFTEST) {
  // Shove one car 1.2 m along the row, into the next bay. Done in the LIVE
  // scene so the mutation is of the thing being measured.
  const moved = await p.evaluate(() => {
    const s = window.__ct.scene(); s.updateMatrixWorld(true);
    // OUTERMOST GROUPS ONLY — the same rule the measurement uses. The first
    // version of this selftest collected nested groups, so "the two lowest-x
    // cars" were an outer group and its own child: it moved a car relative to
    // ITSELF, the world did not change, and the check correctly reported no
    // overlap. That read as "the guard is asleep" when the guard was fine and
    // the mutation was a no-op — which is the more dangerous way round, since
    // I would have gone looking in the wrong file.
    const roots = new Set(), cars = [];
    const inside = (o) => { for (let q = o.parent; q; q = q.parent) if (roots.has(q)) return true; return false; };
    s.traverse((o) => {
      if (!o.isGroup) return;
      let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
      if (mod !== 'lot' || inside(o)) return;
      let n = 0; o.traverse((c) => { if (c.isMesh) n++; });
      if (n >= 8) { roots.add(o); cars.push(o); }
    });
    if (cars.length < 2) return 0;
    // move in WORLD terms: these groups are added straight to the scene, but
    // saying so explicitly means a future reparenting cannot silently make the
    // mutation a no-op again.
    cars.sort((a, c) => a.getWorldPosition(new (s.position.constructor)()).x
                      - c.getWorldPosition(new (s.position.constructor)()).x);
    const V = s.position.constructor;
    const p0 = cars[0].getWorldPosition(new V());
    const p1 = cars[1].getWorldPosition(new V());
    cars[1].position.x += (p0.x + 0.15) - p1.x;
    cars[1].position.z += p0.z - p1.z;
    cars[1].updateMatrixWorld(true);
    const after = cars[1].getWorldPosition(new V());
    return Math.abs(after.x - (p0.x + 0.15)) < 0.01 ? 1 : 0;
  });
  console.log(`selftest: parked one car 0.15 m from another (${moved}) — this MUST go red`);
}

const world = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const carOf = (o) => {
    const inv = o.matrixWorld.clone().invert();
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    o.traverse((c) => {
      if (!c.isMesh || !c.geometry) return;
      if (!c.geometry.boundingBox) c.geometry.computeBoundingBox();
      const bb = c.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(c.matrixWorld));
      x0 = Math.min(x0, bb.min.x); x1 = Math.max(x1, bb.max.x);
      z0 = Math.min(z0, bb.min.z); z1 = Math.max(z1, bb.max.z);
    });
    const e = o.matrixWorld.elements;
    // AXES STRAIGHT OUT OF THE MATRIX, not rebuilt from a yaw. Recomputing a
    // direction from an angle is what produced both facing bugs this file was
    // just fixed for; there is no reason to reintroduce the risk here.
    return { x: e[12], z: e[14],
      ax: { x: e[0], z: e[2] }, az: { x: e[8], z: e[10] },
      cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2 };
  };
  const cars = [], props = [];
  // ONE CAR IS ONE CAR. A car is a group of groups, so "any group with 8+
  // meshes" matched the outer group AND an inner one, and the first run
  // reported five cars overlapping themselves by 1.88 m — their own width,
  // which is the giveaway. Only the OUTERMOST qualifying group counts.
  const carRoots = new Set();
  const insideACar = (o) => { for (let q = o.parent; q; q = q.parent) if (carRoots.has(q)) return true; return false; };
  s.traverse((o) => {
    let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
    if (mod !== 'lot') return;
    if (o.isGroup) {
      if (insideACar(o)) return;
      let n = 0; o.traverse((c) => { if (c.isMesh) n++; });
      if (n >= 8) { carRoots.add(o); cars.push(carOf(o)); }
      return;
    }
    // FURNITURE the cars must also clear: anything solid this module put down
    // that stands on the deck. Taken as world boxes from geometry, low and
    // wide enough to be in a car's way.
    if (!o.isMesh || !o.geometry) return;
    if (insideACar(o)) return;                  // a car's own parts are not fixtures
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const h = bb.max.y - bb.min.y, w = bb.max.x - bb.min.x, d = bb.max.z - bb.min.z;
    if (bb.min.y > 1.4) return;                 // above a bonnet: banners, bunting, signage
    if (h < 0.12) return;                       // decals and paint on the deck
    if (w < 0.06 && d < 0.06) return;           // wires
    props.push({ x0: bb.min.x, x1: bb.max.x, z0: bb.min.z, z1: bb.max.z, h: +h.toFixed(2) });
  });
  return { cars, props };
});

// ── SAT for two oriented rectangles: the gap along the axis of least overlap
const corners = (c) => {
  const ax = c.ax, az = c.az;
  // box centre in world: the group's origin plus its own-frame centre offset
  const px = c.x + ax.x * c.cx + az.x * c.cz;
  const pz = c.z + ax.z * c.cx + az.z * c.cz;
  const out = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    out.push({ x: px + ax.x * sx * c.hx + az.x * sz * c.hz,
               z: pz + ax.z * sx * c.hx + az.z * sz * c.hz });
  return { pts: out, axes: [ax, az] };
};
const gapAlong = (A, B, ax) => {
  const proj = (pts) => { let lo = 1e9, hi = -1e9; for (const q of pts) { const v = q.x * ax.x + q.z * ax.z; lo = Math.min(lo, v); hi = Math.max(hi, v); } return [lo, hi]; };
  const [a0, a1] = proj(A), [b0, b1] = proj(B);
  return Math.max(b0 - a1, a0 - b1);          // >0 separated by that much
};
const clearance = (c1, c2) => {
  const A = corners(c1), B = corners(c2);
  let best = -1e9;
  for (const ax of [...A.axes, ...B.axes]) best = Math.max(best, gapAlong(A.pts, B.pts, ax));
  return best;                                 // <0 means overlapping
};

const cars = world.cars;
console.log(`\n  ${cars.length} cars, ${world.props.length} solid fixtures on the deck`);
const sizes = {};
for (const c of cars) { const k = `${(c.hx * 2).toFixed(2)} x ${(c.hz * 2).toFixed(2)}`; sizes[k] = (sizes[k] ?? 0) + 1; }
console.log(`  body sizes (width x length), from the built geometry:`);
for (const [k, n] of Object.entries(sizes).sort((a, c) => c[1] - a[1])) console.log(`    ${String(n).padStart(2)} x   ${k} m`);

const FAIL = [];
let worst = { d: 1e9, a: null, b: null };
const tight = [];
for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
  const d = clearance(cars[i], cars[j]);
  if (d < worst.d) worst = { d, a: cars[i], b: cars[j] };
  if (d <= TOUCH) FAIL.push(`cars at (${cars[i].x.toFixed(1)}, ${cars[i].z.toFixed(1)}) and `
    + `(${cars[j].x.toFixed(1)}, ${cars[j].z.toFixed(1)}) OVERLAP by ${(-d).toFixed(2)} m`);
  else if (d < SNUG) tight.push([cars[i], cars[j], d]);
}
console.log(`\n  closest pair of cars: ${worst.d.toFixed(3)} m`
  + `  between (${worst.a?.x.toFixed(1)}, ${worst.a?.z.toFixed(1)}) and (${worst.b?.x.toFixed(1)}, ${worst.b?.z.toFixed(1)})`);
if (tight.length) {
  console.log(`  ${tight.length} pairs closer than ${SNUG} m — reported, not failed (a real lot parks tight):`);
  for (const [a, c, d] of tight.slice(0, 5)) console.log(`     ${d.toFixed(2)} m  (${a.x.toFixed(1)}, ${a.z.toFixed(1)}) / (${c.x.toFixed(1)}, ${c.z.toFixed(1)})`);
}

// ── cars against the furniture: fence, office, pole sign, cones, board
let worstProp = { d: 1e9, c: null, q: null };
for (const c of cars) {
  for (const q of world.props) {
    // the fixture as a zero-yaw OBB
    const f = { x: (q.x0 + q.x1) / 2, z: (q.z0 + q.z1) / 2, cx: 0, cz: 0,
      ax: { x: 1, z: 0 }, az: { x: 0, z: 1 },
      hx: (q.x1 - q.x0) / 2, hz: (q.z1 - q.z0) / 2 };
    const d = clearance(c, f);
    if (d < worstProp.d) worstProp = { d, c, q };
    if (d <= TOUCH) FAIL.push(`a car at (${c.x.toFixed(1)}, ${c.z.toFixed(1)}) clips a fixture `
      + `spanning x ${q.x0.toFixed(1)}..${q.x1.toFixed(1)} z ${q.z0.toFixed(1)}..${q.z1.toFixed(1)} `
      + `(h ${q.h}) by ${(-d).toFixed(2)} m`);
  }
}
console.log(`  closest car-to-fixture: ${worstProp.d === 1e9 ? 'no fixtures' : worstProp.d.toFixed(3) + ' m'}`);

await b.close();
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); FAIL.push('page errors'); }
if (FAIL.length) {
  console.error(`\nSTOCK IS CLIPPING (${FAIL.length}):`);
  for (const f of FAIL.slice(0, 12)) console.error(`  ${f}`);
  if (FAIL.length > 12) console.error(`  ...and ${FAIL.length - 12} more`);
  if (SELFTEST) { console.log('SELFTEST PASSED — the shoved car was caught'); process.exit(0); }
  process.exit(1);
}
if (SELFTEST) { console.error('\nSELFTEST FAILED — a car was parked 0.15 m from another and this did not notice.'); process.exit(2); }
console.log(`\nno car overlaps another car or anything on the deck.`);
