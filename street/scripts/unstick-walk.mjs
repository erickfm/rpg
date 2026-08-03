// Get deliberately stuck, over and over, and prove you always get out.
//
// The user: *"im literally stuck here. i think we need some sort of stuck
// protection or something smarter around collision and blocking"* — wedged
// between two parked cars with no input that could help, because
// `FPRig.blocked()` only ever asks about the position you are moving TO. Once
// you are inside a collider every direction is refused as well.
//
// So this does not test the one gap in the screenshot. It finds EVERY narrow
// gap in the world — every pair of colliders closer together than the 0.72 m
// player — and tries to get stuck in all of them, plus dead centre inside
// every named trap the brief lists. The specific parked cars that caused this
// are builder H's to re-space; the point of the safety net is that the next
// trap, wherever it is, is survivable.
//
// A COLLIDER IS NOT ITS min/max WHEN IT IS TURNED, and every predicate below
// used to assume it was. `fp.ts` gained `AABB.rot` so the bodega's 45-degree
// chamfer could be one box instead of a staircase of eight; on a turned box
// `minX..maxX / minZ..maxZ` are extents in the box's OWN frame, and `fp.ts:287`
// maps the world point into that frame (`inFrame`) before comparing. This file
// predates that and never adopted it, so it was comparing raw world x/z against
// own-frame extents — for the chamfer, an axis-aligned 2.83 x 1.41 rectangle
// standing in for a box turned 45 degrees.
//
// That produced a PHANTOM at (8.50, -94.50): the centre of the chamfer, i.e.
// the middle of solid masonry. `unstick` ejects the player from it correctly,
// 1.068 m along the box's short axis — which is exactly `0.707 + RADIUS`, the
// minimum translation out — and `fp.ts` then agrees he is free. This file's
// rotation-blind test still called him buried in a wall, and the desk filed it
// as the session's one player-facing bug. It is not reachable on foot at all:
// walked at from 16 headings, 3 m out, the closest approach is 1.106 m, three
// player-radii short (notes/w38-chamfer-trap-premise.md).
//
// So every "is this point inside something" question here now goes through
// `scripts/lib/collide.mjs`, which is `fp.ts`'s own arithmetic in one place
// rather than a fourth hand copy of it.
//
// AND A COLLIDER THAT WALKS IS NOT A TRAP. Every question below is about
// GEOMETRY — is there a slot in this world a body can enter and not leave —
// and twelve of the boxes in `colliders()` are citizens and traffic. A
// pedestrian passing a parked car forms a 0.78 m corridor for about a second
// and then walks out of it; scoring that as a trap is GOTCHAS 73, the single
// cause behind four separate false defects. So the trap list and both verdicts
// read `__ct.staticColliders()`, which separates them BY OBJECT IDENTITY
// against the registration hooks rather than by shape or by holding still.
//
// Usage: SHOT_URL=http://localhost:4185/ node scripts/unstick-walk.mjs
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { assertStaticColliders, installCollide } from './lib/collide.mjs';
import { reportWorld } from './lib/which-world.mjs';

const RADIUS = 0.36, PLAYER = RADIUS * 2;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(aim('http://localhost:4185/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.colliders !== undefined, { timeout: 15000 });
await reportWorld(p, aim('http://localhost:4185/'));   // GOTCHAS 26: prove it, do not just name it
await installCollide(p);   // window.__probeCollide — fp.ts's blocked(), frame-aware. Throws if it did not arrive.
const counts = await assertStaticColliders(p);   // throws rather than falling back to colliders()
console.log(`colliders ${counts.all} = ${counts.statics} static + ${counts.actors} that walk;`
  + ' every verdict below is against the static set');
await p.waitForTimeout(300);

const pos = () => p.evaluate(() => window.__ct.pos());
const warp = (x, z, gy) => p.evaluate(([x, z, gy]) => window.__ct.warp(x, z, 0, gy, 0), [x, z, gy]);
const hold = async (k, ms) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); await p.waitForTimeout(60); };
const isBlocked = (x, z) => p.evaluate(([x, z, R]) =>
  window.__probeCollide.blockedAt(window.__ct.staticColliders(), x, z, R), [x, z, RADIUS]);

// Every trap the world offers, found rather than listed.
const traps = await p.evaluate(([RADIUS, PLAYER]) => {
  // IN WORLD AXES, which for a turned box is not what its min/max say. The
  // pair search below reasons about "are these two things beside each other",
  // and that is a question about world space; comparing one box's own-frame
  // extents against another's is comparing two different coordinate systems.
  // `worldAabb` is the identity on every unrotated collider — which is all but
  // one of them — so the search this file has always done is unchanged, and on
  // the chamfer it widens 2.83 x 1.41 to the 3.00 x 3.00 the box really covers.
  // Candidates only: the verdict is always `blockedAt`, never this.
  //
  // The CENTRE is unaffected by either reading — `rot` turns a box about its
  // own centre — so the "dead centre inside each solid thing" case below picks
  // exactly the same points it always did.
  const cols = window.__ct.staticColliders()
    .map((c) => window.__probeCollide.worldAabb(c))
    .filter((c) =>
      // the street and its interiors, not the giant boundary walls: a "gap"
      // between two 100 m walls is a street, not a trap
      (c.maxX - c.minX) < 8 && (c.maxZ - c.minZ) < 8);
  const out = [];
  // 1. dead centre inside each solid thing — the dumpster, a bench, a crate,
  //    a car. This is "a collider appeared on top of you".
  for (const c of cols) {
    out.push({ kind: 'inside', x: (c.minX + c.maxX) / 2, z: (c.minZ + c.maxZ) / 2 });
  }
  // 2. the midpoint of every gap too narrow for the player to occupy — the
  //    exact shape of the parked-car wedge in the screenshot
  for (let i = 0; i < cols.length; i++) {
    for (let j = i + 1; j < cols.length; j++) {
      const a = cols[i], d = cols[j];
      const overlapZ = a.minZ < d.maxZ && d.minZ < a.maxZ;
      const overlapX = a.minX < d.maxX && d.minX < a.maxX;
      if (overlapZ) {
        const gap = Math.max(d.minX - a.maxX, a.minX - d.maxX);
        if (gap > 0 && gap < PLAYER + 0.25) {
          const x = d.minX > a.maxX ? (a.maxX + d.minX) / 2 : (d.maxX + a.minX) / 2;
          const z = (Math.max(a.minZ, d.minZ) + Math.min(a.maxZ, d.maxZ)) / 2;
          out.push({ kind: `gap ${gap.toFixed(2)}m`, x, z });
        }
      }
      if (overlapX) {
        const gap = Math.max(d.minZ - a.maxZ, a.minZ - d.maxZ);
        if (gap > 0 && gap < PLAYER + 0.25) {
          const z = d.minZ > a.maxZ ? (a.maxZ + d.minZ) / 2 : (d.maxZ + a.minZ) / 2;
          const x = (Math.max(a.minX, d.minX) + Math.min(a.maxX, d.maxX)) / 2;
          out.push({ kind: `gap ${gap.toFixed(2)}m`, x, z });
        }
      }
    }
  }
  return out;
}, [RADIUS, PLAYER]);

console.log(`${traps.length} traps found (inside-a-collider + every sub-${(PLAYER + 0.25).toFixed(2)} m gap)\n`);

// ── ONE ROUND TRIP PER TRAP, AND IT ENDS ON WORLD STATE ───────────────────
//
// THIS CHECK COST 11m15s AND WAS OVER EVERY TIMEOUT IN THE HARNESS — two
// baseline attempts never finished at all, one a page crash at 4m40s and one
// the 10-minute cap. A check that cannot complete reports nothing, which is
// strictly worse than a check that is wrong.
//
// The cost was a FIXED 1.1 s wall-clock wait per trap, and wall clock is the
// wrong instrument for this (GOTCHAS 30/43, and the same fault fixed in
// jump-walk and wetness): `dt` is clamped at 0.05 s (src/main.ts:107), so the
// simulation advances at most 50 ms per frame however long the frame really
// took. 1.1 s of waiting is 1.1 s of waiting on FRAMES, and frames are
// observable — so wait for the frames and stop the moment the world has
// answered. Nearly every trap frees the player in a fraction of that.
//
// COVERAGE IS UNTOUCHED. All 582 traps are still visited and the verdicts are
// the same three: escaped, still inside, or free-but-boxed-in. The item is
// explicit that reducing the trap count would be cutting coverage, and this
// does not reduce it — it stops paying a second of wall clock for an answer
// that arrived in a tenth.
//
// WHY 40 FRAMES OF STILLNESS AND NOT 5. `FPRig.unstick` has a PATIENCE of
// 0.45 s (fp.ts:371): a player it cannot push out is teleported back to
// `lastGood` only after 0.45 s of ACCUMULATED dt. Ending the probe on a short
// stall would cut that rescue off before it fires and invent failures the world
// does not have. 0.45 s of dt is 9 frames at the 0.05 s clamp and 27 at a
// 60 fps 1/60 s step, so the worst case is 27 and 40 clears it with margin —
// derived from fp.ts's own constant, not tuned until the suite went green.
const STILL_FRAMES = 40;
const FRAME_BUDGET = 240;      // ~4 s at 60 fps; a terminator, never the path
/** Warp into a trap and watch, per rendered frame, until the WORLD says the
 *  attempt is over. Returns where the rig ended, whether it is still inside,
 *  and whether any direction is open — the same three facts as before, in one
 *  round trip instead of five. */
const probeTrap = (x, z) => p.evaluate(([x, z, R, stillNeed, budget]) => new Promise((resolve) => {
  // fp.ts's own test, frame and all — see scripts/lib/collide.mjs. Read fresh
  // each frame on purpose: the array is live, and geometry can be registered
  // while the world runs.
  //
  // STATIC, and this is the load-bearing half of the verdict rather than a
  // tidy-up. `anyWayOut` below asks whether ANY of eight directions is open; a
  // citizen who wanders within 0.61 m of the resting player closes one of them
  // for a second, and with the unfiltered array that is scored as "came free
  // but every direction is still blocked" — a trap report caused by a passer-by
  // who has already walked on by the time anyone reads it. The player is not
  // trapped by a person: they leave. Whether the WORLD has a slot you cannot
  // get out of is the question this file was written to answer.
  const blockedAt = (px, pz) => window.__probeCollide.blockedAt(window.__ct.staticColliders(), px, pz, R);
  // …and having come free, you are genuinely not trapped: there is SOME
  // direction you can move in. Asked of the collider predicate rather than by
  // driving the rig in a couple of arbitrary directions — the thrift's aisles
  // clear the player by 0.19 m a side on purpose, so "hold W and expect a
  // metre" fails rooms that are working exactly as designed. Eight directions,
  // a quarter metre, is the honest statement of "not stuck".
  const anyWayOut = (px, pz) => {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      if (!blockedAt(px + Math.cos(a) * 0.25, pz + Math.sin(a) * 0.25)) return true;
    }
    return false;
  };
  // no input at all, which is the honest test: a stuck player pressing nothing
  // must still come free
  window.__ct.warp(x, z, 0, 0, 0);
  let n = 0, still = 0, lx = null, lz = null;
  const done = (why) => {
    const [px, , pz] = window.__ct.pos();
    resolve({ why, frames: n, x: px, z: pz, blocked: blockedAt(px, pz), canMove: anyWayOut(px, pz) });
  };
  const tick = () => {
    const [px, , pz] = window.__ct.pos();
    if (n > 0 && !blockedAt(px, pz)) return done('free');
    if (lx !== null && Math.hypot(px - lx, pz - lz) < 1e-4) still++; else still = 0;
    lx = px; lz = pz;
    if (still >= stillNeed) return done('stalled');
    if (++n > budget) return done('budget');
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}), [x, z, RADIUS, STILL_FRAMES, FRAME_BUDGET]);

const fails = [];
let tested = 0, freedBy = { push: 0, alreadyOut: 0 };
let frameTotal = 0;
for (const t of traps) {
  if (!(await isBlocked(t.x, t.z))) { freedBy.alreadyOut++; continue; }   // gap wide enough after all
  tested++;
  const r = await probeTrap(t.x, t.z);
  frameTotal += r.frames;
  if (r.blocked) {
    fails.push(`${t.kind} @ ${t.x.toFixed(2)},${t.z.toFixed(2)} — still inside a collider after `
      + `${r.frames} rendered frames (${r.why}) (at ${r.x.toFixed(2)},${r.z.toFixed(2)})`);
    continue;
  }
  if (!r.canMove) {
    fails.push(`${t.kind} @ ${t.x.toFixed(2)},${t.z.toFixed(2)} — came free but every direction is still blocked `
      + `(at ${r.x.toFixed(2)},${r.z.toFixed(2)})`);
    continue;
  }
  freedBy.push++;
}

// Cross-check: for a handful, actually DRIVE the rig away, so the cheap
// predicate above is never trusted on its own.
let driven = 0, drivenOk = 0, drivenFails = 0;
for (const t of traps.slice(0, 6)) {
  if (!(await isBlocked(t.x, t.z))) continue;
  await warp(t.x, t.z, 0);
  await p.waitForTimeout(1100);
  const o = await pos();
  let best = 0;
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    await p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0, 0), [o[0], o[2], yaw]);
    await p.waitForTimeout(50);
    const a = await pos();
    await hold('w', 400);
    const c = await pos();
    best = Math.max(best, Math.hypot(c[0] - a[0], c[2] - a[2]));
  }
  driven++;
  if (best > 0.25) drivenOk++;
  else {
    drivenFails++;
    fails.push(`DRIVEN ${t.kind} @ ${t.x.toFixed(2)},${t.z.toFixed(2)} — rig could not walk away (${best.toFixed(2)} m)`);
  }
}
console.log(`${driven} of them also driven for real: ${drivenOk} walked away under their own steam`);
console.log(`${tested} were genuinely stuck; ${freedBy.push} freed themselves`);
console.log(`   (${frameTotal} rendered frames across ${tested} probes, ${tested ? (frameTotal / tested).toFixed(1) : 0} each —`
  + ` the fixed wait this replaced was ~66 frames every time)`);
console.log(`${freedBy.alreadyOut} candidate gaps turned out to be passable already\n`);
for (const f of fails) console.log(`  FAIL  ${f}`);
// ── TWO POPULATIONS, TWO NUMBERS ──────────────────────────────────────────
//
// This read `${fails.length}/${tested}` and printed **537/531** on a real run —
// a verdict line that reads as nonsense, recorded by w37 in
// notes/archive/w37-walking-tier-failpaths.md and left as "cosmetic".
//
// It is not quite cosmetic: it is a ratio taken across two different
// populations. `tested` counts the traps that were GENUINELY STUCK and went
// through the cheap predicate; `fails` holds those failures PLUS the `DRIVEN`
// ones from the cross-check loop above, which walks `traps.slice(0, 6)` — a
// different sample, counted after `tested` has stopped moving. So the numerator
// could exceed the denominator, and a reader trying to work out how bad a run
// was got a fraction greater than one.
//
// Reported separately, each against the sample it actually came from. The exit
// code is unchanged and still covers both.
const stuckFails = fails.length - drivenFails;
console.log(fails.length
  ? `\n${stuckFails}/${tested} traps are still traps`
    + (drivenFails ? `, and ${drivenFails}/${driven} of the driven cross-checks could not walk away` : '')
  : `\nall ${tested} traps release the player`
    + (driven ? `, and all ${driven} driven cross-checks walked away` : ''));
if (errs.length) console.log('\npage errors:\n  ' + errs.slice(0, 5).join('\n  '));

// ── POPULATION FLOORS — BOTH OF THEM ──────────────────────────────────────
//
// ITEM 260, and it is the dangerous shape rather than the obvious one. Every
// verdict above is a FILTER over a population: with no traps found, `fails` is
// empty and this printed **"all 0 traps release the player"** and exited 0.
// Green, cheerful, and about nothing — GOTCHAS 79 verbatim.
//
// **AND IT NOW CARRIES A CERTIFICATE.** Item 258 gave this check a registered
// `canfail` case, so `checks-can-fail` reports it as a proven guard. A
// certificate on an unfloored check is worse than no certificate: it converts
// "nobody has watched this fail" into "somebody has", while the run that
// watched it can still be a run over an empty list. The mutation proves the
// verdict CAN go red; the floor is what proves the verdict was ASKED.
//
// Two numbers, because the file already carefully separates two populations
// (see the note above) and either can collapse on its own:
//
//   CANDIDATES  the gaps the seed found at all. Measured at 586 on this world
//               (item 260's row). A collapse here means the trap-finder broke.
//   TESTED      the subset that were GENUINELY STUCK and went through the
//               probe. Measured at 543. A collapse here means every candidate
//               turned out passable, which is either a fixed world or — far
//               more likely — a broken `isBlocked`.
//
// Set well under the real figures and hugely over the collapse they catch, and
// they are asserted BEFORE the pass/fail exit so a blinded run can never report
// green. Exit 2, not 1: this is the instrument failing, not the world.
const CAND_FLOOR = 200, TESTED_FLOOR = 150;
if (traps.length < CAND_FLOOR || tested < TESTED_FLOOR) {
  console.error(`\nTHIS CHECK MEASURED (ALMOST) NOTHING: ${traps.length} candidate gaps`
    + ` (floor ${CAND_FLOOR}), ${tested} genuinely stuck (floor ${TESTED_FLOOR}).`);
  console.error('  Every verdict above is a filter over that population, and all of them pass');
  console.error('  for free at zero — "all 0 traps release the player" is not a pass. This is');
  console.error('  the trap FINDER failing, or the world no longer publishing colliders; it is');
  console.error('  not a clean bill of health. Item 258 gave this check a canfail case, so a');
  console.error('  blinded run would otherwise be reported as a PROVEN guard.');
  await b.close();
  process.exit(2);
}
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
