// Item 170: *"benches need space away from the path."*
//
// THE ITEM SAYS THIS IS A WALKING PROBLEM, NOT A LOOKING PROBLEM, and it is
// right — `bench-clearance.mjs` measures boxes, and a box is a claim about
// collision, not a demonstration of it. So this WALKS the loop past every bench
// with the real movement code, and separately SITS on each one and asks whether
// the sitter is in the walkway.
//
// TWO LEGS, and the second is the half a clearance number cannot answer:
//
//   1  WALK the loop centreline all the way round, in `__ct.step()`-sized moves,
//      and record the closest the player's own capsule ever comes to a bench
//      collider — and whether he is ever pushed off the centreline at all.
//   2  SIT on every bench and ask whether the seated pose is inside the path.
//
// A player walking the CENTRELINE has PATH_W/2 = 0.75 m to the edge, so the
// clean result is that no bench ever comes within (0.75 - RADIUS) of him and
// nothing displaces him. The interesting number is what happens at the EDGE,
// which the walk also covers: it runs the centreline and both shoulders.
//
//   SHOT_URL=http://localhost:4360/ node scripts/probes/w80-walk-the-benches.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4360/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1024, height: 640 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await p.waitForTimeout(500);

const out = await p.evaluate(async () => {
  const loopM = [], benches = [];
  window.__ct.scene().traverse((o) => {
    if (o.userData?.parkBench) benches.push({ ...o.userData.parkBench });
    if (o.userData?.parkLoop) loopM.push({ ...o.userData.parkLoop });
  });
  if (!loopM.length || !benches.length) return { fatal: `loops ${loopM.length} benches ${benches.length}` };
  const loop = loopM[0], R = window.__ct.playerRadius();
  const gapTo = (x, z, r) => Math.hypot(Math.max(0, r.minX - x, x - r.maxX),
    Math.max(0, r.minZ - z, z - r.maxZ));

  // sample the centreline and both shoulders
  const legs = [];
  const c = loop.centreline;
  for (let i = 0; i < c.length; i++) {
    const [ax, az] = c[i], [bx, bz] = c[(i + 1) % c.length];
    const len = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / len, uz = (bz - az) / len;
    const nx = -uz, nz = ux;                       // the across-path normal
    legs.push({ ax, az, ux, uz, nx, nz, len });
  }
  // OFFSETS ACROSS THE PATH, and the outer two are the point: a walker is
  // entitled to the whole width, so the shoulder is where a bench would actually
  // be brushed. Inset by RADIUS so the capsule itself stays on the path.
  const half = loop.halfWidth;
  const lanes = [0, +(half - R), -(half - R)];

  const rows = [];
  let worstAny = { d: Infinity };
  let displaced = 0, samples = 0;
  for (const lane of lanes) {
    for (const L of legs) {
      const n = Math.max(2, Math.ceil(L.len / 0.25));
      for (let k = 0; k <= n; k++) {
        const t = (k / n) * L.len;
        const x = L.ax + L.ux * t + L.nx * lane;
        const z = L.az + L.uz * t + L.nz * lane;
        samples++;
        // the geometric closest approach of the CAPSULE to any bench collider
        let d = Infinity, which = -1;
        for (let i = 0; i < benches.length; i++) {
          const g = gapTo(x, z, benches[i]) - R;
          if (g < d) { d = g; which = i; }
        }
        if (d < worstAny.d) worstAny = { d, which, x, z, lane };
        if (d < 0) displaced++;
      }
    }
    rows.push({ lane: +lane.toFixed(3) });
  }

  // THE STATIONS TO WALK FOR REAL, computed here and walked from Node below —
  // there is no in-page stepper to call. My first cut wrote
  // `window.__ct.step?.('w', 0.05)`, and `__ct` PUBLISHES NO `step`, so the
  // optional call was a silent no-op sixty times per bench and the probe would
  // have reported a clean walk having moved nobody. That is the vacuous pass
  // this project keeps finding in its own instruments (GOTCHAS 79); the walk is
  // a real held keypress now, like `D-walk.mjs:90`.
  const stations = [];
  for (let i = 0; i < benches.length; i++) {
    const bn = benches[i];
    const cx = (bn.minX + bn.maxX) / 2, cz = (bn.minZ + bn.maxZ) / 2;
    let near = null;
    for (const L of legs) {
      const n = Math.max(2, Math.ceil(L.len / 0.1));
      for (let k = 0; k <= n; k++) {
        const t = (k / n) * L.len;
        const x = L.ax + L.ux * t, z = L.az + L.uz * t;
        const d = Math.hypot(x - cx, z - cz);
        if (!near || d < near.d) near = { d, x, z, L, t };
      }
    }
    // start 2.5 m before it, on the SHOULDER NEAREST the bench — the lane where
    // a walker would actually be brushed — and run past it
    const side = Math.sign((cx - near.x) * near.L.nx + (cz - near.z) * near.L.nz) || 1;
    const lane = side * (half - R);
    const t0 = Math.max(0, near.t - 2.5);
    const sx = near.L.ax + near.L.ux * t0 + near.L.nx * lane;
    const sz = near.L.az + near.L.uz * t0 + near.L.nz * lane;
    stations.push({ bench: i, cx: +cx.toFixed(2), cz: +cz.toFixed(2),
      lane: +lane.toFixed(2), sx, sz,
      // atan2(ux, -uz), NOT atan2(ux, uz). This world's forward is
      // `(sin yaw, -cos yaw)` — `fp.ts:947` — and the wrong sign here walked the
      // three z-leg benches 3.8-5.4 m BACKWARDS while the probe printed
      // "BLOCKED". It could not show up on the four x-leg benches, where uz is 0
      // and both spellings agree, which is exactly why `along` is measured as a
      // SIGNED projection rather than as a distance: a distance would have made
      // a backwards walk look like a good one.
      yaw: Math.atan2(near.L.ux, -near.L.uz),
      ux: near.L.ux, uz: near.L.uz, nx: near.L.nx, nz: near.L.nz });
  }

  // ── SITTING: is the seated pose in the walkway? ───────────────────────────
  const seats = (window.__ct.seats?.() ?? []).map((s) => ({ x: s.x, z: s.z, label: s.label }));
  const seatedInPath = [];
  for (const s of seats) {
    // distance from the seat pose to the loop centreline
    let d = Infinity;
    for (const L of legs) {
      const n = Math.max(2, Math.ceil(L.len / 0.1));
      for (let k = 0; k <= n; k++) {
        const t = (k / n) * L.len;
        const g = Math.hypot(L.ax + L.ux * t - s.x, L.az + L.uz * t - s.z);
        if (g < d) d = g;
      }
    }
    // his KNEES, not his hips: a seated person reaches about a radius forward
    if (d - R < half) seatedInPath.push({ ...s, d: +d.toFixed(2) });
  }

  return { benches: benches.length, samples, displaced,
    worst: { d: +worstAny.d.toFixed(3), bench: worstAny.which,
      at: [+worstAny.x.toFixed(2), +worstAny.z.toFixed(2)], lane: +worstAny.lane.toFixed(2) },
    lanes: lanes.map((l) => +l.toFixed(3)), half, R, stations,
    seats: seats.length, seatedInPath };
});

if (out.fatal) { console.error(`CANNOT MEASURE: ${out.fatal}`); await b.close(); process.exit(3); }

console.log(`\n${out.benches} benches · path half-width ${out.half} m · player radius ${out.R} m`);
console.log(`lanes walked across the path: ${out.lanes.join(', ')} m off the centreline\n`);
console.log(`${out.samples} stations swept round the whole loop on all three lanes`);
console.log(`  closest a walker's capsule ever comes to a bench collider: ${out.worst.d} m`);
console.log(`  at (${out.worst.at.join(', ')}) on the ${out.worst.lane} m lane, bench #${out.worst.bench}`);
console.log(`  stations where the capsule would INTERSECT a bench: ${out.displaced}`);

// ── WALK PAST EVERY BENCH FOR REAL ──────────────────────────────────────────
//
// A HELD keypress, not a tap (BUILDER-BRIEF §5), and 1.6 s of it, which at the
// walk speed covers the 2.5 m run-up plus the bench. `pos()` before and after
// says how far he actually got and whether anything pushed him sideways.
console.log('\nwalking PAST each bench on the shoulder nearest it, 1.6 s of held `w`:');
console.log('bench centre           lane    from              to                along   pushed off lane');
let anyPushed = 0, anyShort = 0;
for (const st of out.stations) {
  const gy = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [st.sx, st.sz]);
  await p.evaluate(([x, z, yaw, gy]) => window.__ct.warp(x, z, yaw, gy, 0), [st.sx, st.sz, st.yaw, gy]);
  await p.waitForTimeout(140);
  const a = await p.evaluate(() => window.__ct.pos());
  await p.keyboard.down('w');
  await p.waitForTimeout(1600);
  await p.keyboard.up('w');
  await p.waitForTimeout(120);
  const c = await p.evaluate(() => window.__ct.pos());
  const dx = c[0] - a[0], dz = c[2] - a[2];
  const along = dx * st.ux + dz * st.uz;
  const drift = Math.abs(dx * st.nx + dz * st.nz);
  if (drift > 0.10) anyPushed++;
  if (along < 3.0) anyShort++;
  console.log(`(${String(st.cx).padStart(8)}, ${String(st.cz).padStart(8)})  ${String(st.lane).padStart(5)}  `
    + `(${a[0].toFixed(2)}, ${a[2].toFixed(2)})`.padEnd(18)
    + `(${c[0].toFixed(2)}, ${c[2].toFixed(2)})`.padEnd(18)
    + `${along.toFixed(2).padStart(6)} m  ${drift.toFixed(3).padStart(6)} m`
    + `${drift > 0.10 ? '   <-- PUSHED' : ''}${along < 3.0 ? '   <-- BLOCKED' : ''}`);
}
console.log(`\n  pushed off the lane by more than 0.10 m: ${anyPushed} of ${out.stations.length}`);
console.log(`  failed to travel 3 m in 1.6 s (i.e. blocked): ${anyShort} of ${out.stations.length}`);

console.log(`\nsitting: ${out.seats} seats registered in the world`);
console.log(out.seatedInPath.length === 0
  ? '  no seated pose in the park is inside the loop path'
  : `  ${out.seatedInPath.length} seated pose(s) INSIDE the path: `
    + out.seatedInPath.map((s) => `"${s.label}" at ${s.d} m from the centreline`).join('; '));
await b.close();
