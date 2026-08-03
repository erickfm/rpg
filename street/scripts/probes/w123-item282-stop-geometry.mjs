// Item 282 — the bus-stop pinch. THE GEOMETRY, measured rather than reasoned.
//
// Three questions the row asks, and this answers the two that are geometric:
//   · where is the bench, where is the crowd-net's bus-stop node, how far apart?
//   · can a WALKER pin at the stop at all? The crowd tests `citAvoid` with a
//     0.28 m half-width (ct/crowd.ts:504) where the player rig carries 0.36 m,
//     so "the player is stopped dead" and "a walker cannot get through" are two
//     different questions and only one of them has been answered.
//
// Deterministic: collider boxes and lane constants off a built bundle. No clock,
// no camera, no repeats — BUILDER-BRIEF §10a.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4194/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.spots, null, { timeout: 30000 });

const CIT_R = 0.28;   // ct/crowd.ts:564, the walker's own footprint
const RIG_R = 0.36;   // the player rig's radius

// every static box on the east walk in the stop's stretch
const band = await p.evaluate(() => {
  const out = [];
  const list = window.__ct.citAvoid ? window.__ct.citAvoid() : window.__ct.colliders();
  for (const a of list) {
    if (a.maxX > 4 && a.minX < 9 && a.maxZ > -40 && a.minZ < -28) {
      out.push({ minX: +a.minX.toFixed(3), maxX: +a.maxX.toFixed(3),
        minZ: +a.minZ.toFixed(3), maxZ: +a.maxZ.toFixed(3) });
    }
  }
  return out.sort((q, r) => q.minZ - r.minZ);
});
console.log(`\n${band.length} static boxes on the east walk, z -40..-28:`);
for (const a of band) console.log(`   x ${a.minX} .. ${a.maxX}   z ${a.minZ} .. ${a.maxZ}`);

// the walls either side of the walk: the kerb edge and the building face
// THE LANES, SAMPLED OVER TIME, NOT OFF ONE FRAME. `ct/crowd.ts:467` assigns
// `ROAD_HALF + 1.05 + (i%3)*0.17` per citizen, so a single frame shows only the
// lanes currently occupied — the first cut of this probe read one lane, derived
// ROAD_HALF from it, and reported a different street on every run. Six walkers
// over a few seconds cover all three.
const seen = new Set();
for (let i = 0; i < 40; i++) {
  for (const x of await p.evaluate(() => window.__ct.walkers().map((w) => +w.x.toFixed(3)))) {
    if (x > 0) seen.add(x);
  }
  await p.waitForTimeout(120);
}
const lanes = [...seen].sort((a2, b2) => a2 - b2);
console.log(`\neast lanes seen over ~5 s: ${JSON.stringify(lanes)}`);

// THE CORRIDOR, and it has TWO sides — that is what my first cut got wrong. The
// east walk runs between the kerb and the BUILDING FACE, and the building's own
// mass is in this list as a box reaching to x 26.7. Taking a plain max over
// every box put the "clear" line 22 m into the shops. Split the list: anything
// whose minX is beyond the walk is the wall, everything else is furniture on the
// kerb side.
const WALL = Math.min(...band.filter((a) => a.minX > 6.5).map((a) => a.minX));
const furniture = band.filter((a) => a.minX <= 6.5);
console.log(`\nbuilding face at x ${WALL}; ${furniture.length} pieces of furniture on the kerb side`);
/** the innermost x a centre of radius r may occupy at this z */
const inner = (z, r) => {
  let lo = -Infinity;
  for (const a of furniture) if (z + r > a.minZ && z - r < a.maxZ) lo = Math.max(lo, a.maxX + r);
  return lo === -Infinity ? null : lo;
};
const outer = (r) => WALL - r;

console.log('\n  z        WALKER corridor (r 0.28)        PLAYER corridor (r 0.36)');
for (let z = -37.0; z <= -32.0; z += 0.5) {
  const w = inner(z, CIT_R), q = inner(z, RIG_R);
  const fmt = (lo, r) => lo === null ? `open .. ${outer(r).toFixed(3)}`
    : `${lo.toFixed(3)} .. ${outer(r).toFixed(3)}  (${(outer(r) - lo).toFixed(3)} m)`;
  console.log(`  ${z.toFixed(1).padStart(6)}   ${fmt(w, CIT_R).padEnd(32)} ${fmt(q, RIG_R)}`);
}

// the tightest z anywhere in the stop, for each footprint
const tight = (r) => {
  let bz = null, bl = -Infinity;
  for (let z = -38; z <= -31; z += 0.01) { const s = inner(z, r); if (s !== null && s > bl) { bl = s; bz = z; } }
  return { z: bz, lo: bl, width: outer(r) - bl };
};
const tw = tight(CIT_R), tp = tight(RIG_R);
console.log(`\ntightest for a WALKER  : z ${tw.z.toFixed(2)}  corridor ${tw.lo.toFixed(3)} .. ${outer(CIT_R).toFixed(3)}  = ${tw.width.toFixed(3)} m`);
console.log(`tightest for the PLAYER: z ${tp.z.toFixed(2)}  corridor ${tp.lo.toFixed(3)} .. ${outer(RIG_R).toFixed(3)}  = ${tp.width.toFixed(3)} m`);

// ROAD_HALF, ANCHORED ON AUTHORED GEOMETRY — NOT ON WHERE PEOPLE ARE STANDING.
// `walkers()` publishes `c.lane` (ct/crowd.ts:1201), which is the walker's LIVE
// lateral position and strays with the route, not the constant it was assigned.
// Deriving ROAD_HALF from it gave 4.95 on one run and 4.80 on the next — a
// different street each time, which is exactly the "needs N runs to mean
// anything" reading BUILDER-BRIEF §10a says not to build on. The bench's own
// collider starts at `BX_FRONT = ROAD_HALF + 0.07` (ct/props.ts:2940, :3094)
// and the flag pole's at `ROAD_HALF + 0.23` (:2840); both are fixed, and they
// agree.
const benchBox = band.filter((a) => a.minX <= 6.5)
  .reduce((a2, c) => (c.maxZ - c.minZ) > (a2.maxZ - a2.minZ) ? c : a2);
const RH = +(benchBox.minX - 0.07).toFixed(3);
const poleBox = band.filter((a) => a.minX <= 6.5 && (a.maxX - a.minX) < 0.2 && a.maxZ > -34)[0];
console.log(`\nROAD_HALF from the bench face: ${RH}`
  + (poleBox ? `; from the flag pole: ${(poleBox.minX - 0.23).toFixed(3)}` : ''));
// the crowd's three citizen lanes are ROAD_HALF + 1.05 + (i%3)*0.17 (ct/crowd.ts:467)
const allLanes = [0, 1, 2].map((i) => RH + 1.05 + i * 0.17);
console.log(`crowd-net's walk lane EAST_X = ROAD_HALF + 1.0 = ${(RH + 1.0).toFixed(2)}`);
console.log(`ct/crowd.ts's three citizen lanes = ${allLanes.map((L) => L.toFixed(2)).join(', ')}`);
{
  const L = RH + 1.0;
  console.log(`  EAST_X   x ${L.toFixed(2)}: walker ${L >= tw.lo ? 'clears' : `blocked by ${(tw.lo - L).toFixed(3)} m`}`
    + ` · player ${L >= tp.lo ? 'clears' : `blocked by ${(tp.lo - L).toFixed(3)} m`}`);
}
console.log('lane-by-lane, at the tightest slice:');
for (const L of allLanes) {
  const wOk = L >= tw.lo && L <= outer(CIT_R);
  const pOk = L >= tp.lo && L <= outer(RIG_R);
  console.log(`  x ${L.toFixed(2)}: walker ${wOk ? 'CLEARS' : `blocked by ${(tw.lo - L).toFixed(3)} m`}`
    + ` · player ${pOk ? 'clears' : `blocked by ${(tp.lo - L).toFixed(3)} m`}`);
}

// where crowd-net puts the bus-stop node, and where the bench actually is
const bench = furniture.reduce((a2, c) => (c.maxZ - c.minZ) > (a2.maxZ - a2.minZ) ? c : a2, furniture[0]);
const benchZ = (bench.minZ + bench.maxZ) / 2;
console.log(`\nbench box: x ${bench.minX}..${bench.maxX}  z ${bench.minZ}..${bench.maxZ}  → centre z ${benchZ.toFixed(2)}`);
// WHERE THE `e-bench` NODE SHOULD BE, computed here the same way ct/crowd-net.ts
// now computes it, so the two can be compared without a `__ct` hook for the
// graph (there is none, and adding one means crosstown.ts — item 282 does not
// name it). props.ts:3122 stands you `BENCH_MAX_X + 0.42` out from the kerb.
const standX = bench.maxX + 0.42;
console.log(`the bench's own standing point (props.ts:3122): x ${standX.toFixed(3)}, z ${benchZ.toFixed(2)}`);
console.log(`  walker there: needs x in ${inner(benchZ, CIT_R).toFixed(3)} .. ${outer(CIT_R).toFixed(3)}`
  + `  → ${standX >= inner(benchZ, CIT_R) && standX <= outer(CIT_R)
    ? `CLEAR by ${(standX - inner(benchZ, CIT_R)).toFixed(3)} m inner, ${(outer(CIT_R) - standX).toFixed(3)} m outer`
    : 'BLOCKED'}`);
console.log(`  the east walk lane (EAST_X = ROAD_HALF + 1.0) is x ${(RH + 1.0).toFixed(2)} —`
  + ` at the bench's z that is ${(inner(benchZ, CIT_R) - (RH + 1.0)).toFixed(3)} m INSIDE the bench for a walker,`
  + ` which is why the node is not on the lane`);
console.log(`the OLD node was at z -36.6 → ${Math.abs(-36.6 - benchZ).toFixed(2)} m down-street of the bench`);
await b.close();
