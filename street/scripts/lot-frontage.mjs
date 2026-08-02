// GOTCHAS §9: the 2 m sidewalk lane past the car lot is sacred. Is it?
//
// I have been asserting it from geometry — "everything this module builds is at
// x >= 7.18, and the walk ends at x = 7" — which is an argument, not a
// measurement. It is also exactly the class of claim this project keeps
// disproving: a collider is not where you think, a wall is a box whose origin
// is somewhere else, an [E] spot sits inside a solid.
//
// So measure it. At each z along the lot's frontage, scan the walk from the
// kerb to the building line and find the WIDEST CONTINUOUS band the rig can
// stand in, against the same collider array the movement code tests. The rig
// is 0.36 m in radius, so a band is only walkable where a 0.36 m disc fits.
//
// WHAT THIS NUMBER IS WORTH, measured rather than assumed. a047183e: "every
// lane number I have quoted was of an empty street, including mine." So is
// this one — and here is exactly how empty.
//
// `__ct.colliders()` holds 310 boxes and the count does not move over ten
// seconds with six citizens walking about: PEOPLE ARE NOT COLLIDERS. That cuts
// both ways.
//
//   · The reading is STABLE. Pedestrians cannot make this check flap, which is
//     why the control (1.54 m) and the lot (1.30 m before D's fix) reproduce
//     to the centimetre run after run.
//   · The reading is of the BUILT lane, not the lane a player has when
//     somebody is standing in it. This check cannot see that and does not
//     claim to.
//
// The populated question is answered elsewhere and was answered yes:
// b0398ead flood-fills from spawn with the movers included, four times, and
// "car lot mid" is reachable in every sample — worst observed clear width
// 0.72 m, exactly the player's own, and connectivity never lost.
//
// Usage: SHOT_URL=http://localhost:4190/ node scripts/lot-frontage.mjs
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { goto } from './lib/reachable.mjs';
// These MIRROR ct/rng.ts. A copy goes stale silently — move the building line
// and this keeps scanning the old band, measuring a strip of road and calling
// it a pavement. confirmBand() below proves them against the world before any
// reading is used, the same guard door301 carries on its own copies.
const ROAD_HALF = 5.0, FACE = 7.0, R = 0.36;
const b = await chromium.launch();
const p = await b.newPage();
const URL = aim('http://localhost:4190/');
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);

// The lot's own frontage, asked for rather than remembered: its stamped meshes.
const span = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  let z0 = 1e9, z1 = -1e9, x0 = 1e9;
  s.traverse((o) => {
    if (!o.isMesh || o.userData?.mod !== 'lot') return;
    const e = o.matrixWorld.elements;
    z0 = Math.min(z0, e[14]); z1 = Math.max(z1, e[14]); x0 = Math.min(x0, e[12]);
  });
  return [z0, z1, x0];
});

// Prove the mirrored constants still describe this world before any reading is
// used. The lot is built AGAINST the building line — its fence sits at
// FACE + 0.18 — so its westmost stamped mesh must be just east of FACE. If it
// is not, FACE has moved and everything below measures the wrong strip of
// ground while looking perfectly plausible. Same guard door301 carries over
// its own copied constants.
{
  const off = span[2] - FACE;
  // THE TWO SIDES OF THIS ARE NOT THE SAME FAULT, and treating them as one
  // made this script STEAL ITS OWN FINDING.
  //
  // Found by mutation: pushing FENCE_X 1.08 m west — a fence standing in the
  // sacred 2 m walk, the exact defect this file exists to catch — came back as
  // "THE CONSTANTS IN THIS SCRIPT NO LONGER DESCRIBE THE WORLD ... Re-read
  // ROAD_HALF / WALK / FACE from ct/rng.ts", and exited BEFORE measuring the
  // walk at all. It was red, so I would have called it caught; a reader would
  // have gone to rng.ts, found all three constants perfectly correct, and had
  // no idea a fence was in the pavement.
  //
  //   off > 1.0   the lot is nowhere near the building line. Nothing this
  //               module does moves it a metre east, so the frame of
  //               reference is what changed. Constants. Abort — every
  //               measurement below would be of the wrong strip of ground.
  //
  //   off < 0     something of MINE is west of the building line. That is not
  //               a frame-of-reference problem, it IS the finding. Fall
  //               through, and let the intrusion analysis name the mesh.
  //
  // If FACE really had moved west, this path still tells the truth — it will
  // report the whole frontage intruding rather than one prop, which reads as
  // the wrong shape of answer and sends you looking at the constants anyway.
  if (off > 1.0) {
    console.error(`\nTHE CONSTANTS IN THIS SCRIPT NO LONGER DESCRIBE THE WORLD.`);
    console.error(`  FACE is ${FACE} here, so the lot's westmost mesh should sit just east of it.`);
    console.error(`  It is at x ${span[2].toFixed(2)}, ${off.toFixed(2)} m EAST — too far to be the frontage.`);
    console.error(`  Re-read ROAD_HALF / WALK / FACE from ct/rng.ts.\n`);
    process.exit(1);
  }
  if (off < -0.05) {
    // AN ASSERTION, not an abort, and not a note either. Letting this fall
    // through to the collider analysis was my first fix and it was worse than
    // the bug: the mutated fence then came back GREEN, because this module
    // deliberately registers no collider for its chain-link — the site wall
    // underneath already stops you — so a fence pushed 1.08 m into the
    // pavement changes no free-centre band at all. The walk measurement is
    // blind to anything without a box, by construction.
    //
    // Which is the whole reason this test has to exist beside it. GOTCHAS 9
    // is not "can you walk the 2 m", it is that the 2 m is THERE: a fence you
    // walk straight through is not a preserved pavement, it is a graphical
    // error you can stand inside. The collider band answers "can I pass" and
    // this answers "is anything of mine standing in it", and neither implies
    // the other.
    console.error(`\nA LOT MESH IS WEST OF THE BUILDING LINE.`);
    console.error(`  x ${span[2].toFixed(2)} — ${Math.abs(off).toFixed(2)} m past FACE ${FACE}, which is the walk.`);
    console.error(`  Nothing this module builds may sit west of the building line (GOTCHAS 9).`);
    console.error(`  Note this is a MESH test: a prop with no collider takes no walkable`);
    console.error(`  width and is still wrong, so the band measurement below cannot see it.\n`);
    process.exitCode = 1;
  } else {
    console.log(`building line FACE ${FACE}; the lot starts ${off.toFixed(2)} m east of it — constants hold`);
  }
}

const cols = await p.evaluate(() => window.__ct.colliders()
  .map((c) => [c.minX, c.maxX, c.minZ, c.maxZ]).filter((c) => c[0] < 500));
await b.close();

const free = (x, z) => !cols.some(([a, b2, c, d]) =>
  x > a - R && x < b2 + R && z > c - R && z < d + R);

// This measures the band of valid CENTRES, not the width of the pavement: a
// 0.36 m rig on a perfectly clear 2.00 m walk can only ever put its centre in
// the middle 1.28 m, because the kerb edge and the building line each cost it
// R. So an absolute threshold is meaningless and my first run invented one —
// it called 1.30 m a failure when 1.30 m is what CLEAR looks like.
//
// A CONTROL settles it instead: the same metric over a stretch of the same
// east walk with no lot on it. Whatever that reads is what this world calls
// unobstructed, and the lot has to match it.
const measure = (z0, z1) => {
  const out = [];
  for (let z = z0; z <= z1; z += 0.25) {
    let best = 0, run = 0;
    for (let x = ROAD_HALF; x <= FACE; x += 0.02) {
      if (free(x, z)) { run += 0.02; best = Math.max(best, run); } else run = 0;
    }
    out.push([+z.toFixed(2), +best.toFixed(2)]);
  }
  return out;
};
const ctrl = measure(-40, -20);           // east walk, well clear of the lot
const mine = measure(span[0], span[1]);
const med = (a) => { const v = a.map((r) => r[1]).sort((x, y) => x - y); return v[v.length >> 1]; };
const CLEAR = med(ctrl);

console.log(`control  east walk z -40 … -20, no lot: median band ${CLEAR.toFixed(2)} m`);
console.log(`         (that is what unobstructed reads as — the walk is`);
console.log(`          ${ROAD_HALF} … ${FACE} and the rig radius is ${R})`);
console.log(`lot      frontage z ${span[0].toFixed(1)} … ${span[1].toFixed(1)}, ${mine.length} samples every 0.25 m`);
// Name what is doing it, so the result routes itself. Anything overlapping the
// walk is listed with how far it reaches in from the building line — the
// question "is this mine" should not need a second script.
// Overlap the frontage for a real length, not merely touch its ends: the
// buildings north and south of the lot ABUT it, so a tolerance let both in and
// the verdict fired on two neighbours' facades. A shared edge is not an
// encroachment.
const over = (c) => Math.min(c[3], span[1]) - Math.max(c[2], span[0]);
const intruders = cols
  .filter((c) => c[1] > ROAD_HALF && c[0] < FACE && over(c) > 0.05)
  .sort((a, b2) => a[2] - b2[2]);

// WHAT THIS FAILS ON, and it took watching it fail to get right.
//
// It used to exit 1 on any sample narrower than the control, which meant it
// went red on the street tree and the fire hydrant — both correct, both
// somebody else's, and both there to be walked around. A verdict that fires on
// furniture doing its job is the thing GOTCHAS §23 is about: real is not the
// same as wrong.
//
// The question this script exists to answer is narrower: is THE SITE eating
// the pavement? The site can only encroach from the building line — everything
// ct/lot.ts builds is east of x = FACE — while street furniture stands out by
// the kerb. So the verdict is intruders attached to the building line, and
// everything else is reported and walked past.
const SITE_EDGE = FACE - 1.0;
const fromSite = intruders.filter((c) => c[1] >= SITE_EDGE);
const bad = mine.filter((r) => r[1] < CLEAR - 0.05);
// No samples means the band was never measured. Without this the reduce below
// returns undefined and the script dies on a property access — an exit 1 that
// looks like a real failure and names nothing.
if (!mine.length) {
  console.error('\nNO SAMPLES TAKEN ALONG THE FRONTAGE — the walk was never measured.');
  console.error(`  span z ${span[0].toFixed(1)} … ${span[1].toFixed(1)} produced no sample points.`);
//
// EXIT 3, not 1. GOTCHAS 32 — which I wrote — reserves 3 for "the check never
// ran, and nothing follows about the world". An empty subject set is exactly
// that: this cannot tell a world that failed to build the thing from a read
// that stopped finding it, so it must not claim the guarded thing is broken.
// 4d549f501 reached the same convention independently while enumerating the
// class; I had used 1 in all four, against my own entry.
  process.exit(3);
}
const worst = mine.reduce((a, r) => (r[1] < a[1] ? r : a), mine[0]);
console.log(`         narrowest ${worst[1].toFixed(2)} m at z ${worst[0]}`);
if (fromSite.length) {
  console.log(`\n${bad.length} of ${mine.length} samples narrower than the control:`);
  for (const [z, w] of bad.slice(0, 6)) console.log(`   z ${z}  ->  ${w} m   (control ${CLEAR.toFixed(2)})`);
  console.log(`\nATTACHED TO THE BUILDING LINE — the site is taking pavement:`);
  for (const c of fromSite) {
    console.log(`   x ${c[0].toFixed(2)}..${c[1].toFixed(2)}  z ${c[2].toFixed(2)}..${c[3].toFixed(2)}`
      + `   reaches ${(FACE - c[0]).toFixed(2)} m in`);
  }
  process.exit(1);
}
console.log(`\nnothing attached to the building line takes pavement — the site`);
console.log(`does not narrow the walk. Measured against a control, not argued.`);
const kerbside = intruders.filter((c) => c[1] < SITE_EDGE);
if (kerbside.length) {
  console.log(`\nreported, not failed on — kerb-side furniture, which is there to be`);
  console.log(`walked around and is not this module's:`);
  for (const c of kerbside) {
    console.log(`   x ${c[0].toFixed(2)}..${c[1].toFixed(2)}  z ${c[2].toFixed(2)}..${c[3].toFixed(2)}`);
  }
}
if (bad.length) console.log(`\n(${bad.length} of ${mine.length} samples run under the control past those.)`);
