// w47 / item 98 — WHY the band breaks, and what shape fixes it.
//
// scripts/approach-band.mjs MEASURED the defect by walking. This explains it,
// and it is only allowed to explain it because it is first shown to REPRODUCE
// the measurement: a model that cannot predict the numbers already on the table
// is a story, not a diagnosis. (BUILDER-BRIEF §7 — a script is a hypothesis,
// the source is the answer.)
//
// THE PREDICATE, transcribed from src/proto/fp.ts:
//
//   TOUCH_MARGIN  = 0.15                              (fp.ts:681)
//   lookTolerance = min(0.26, max(0.20, atan2(r, max(0.35, d))))   (fp.ts:683-719)
//   touching      = d < r + TOUCH_MARGIN              (fp.ts:786)
//   looked        = d < reach(6) && offAxis < lookTolerance(r, d)  (fp.ts:798)
//   offered       = touching || looked
//
// COPIED WITH CITATIONS, NOT IMPORTED, and that is a real cost I am declaring
// rather than hiding (BUILDER-BRIEF §8). fp.ts is a TypeScript module in the
// bundle and item 85 holds it, so importing it here is not available to me. The
// validation below is what makes the copy safe: if any of these four numbers
// drifts from fp.ts, the model stops matching the walked trace and this probe
// starts failing loudly instead of quietly lying.
//
//   node scripts/probes/w47-band-model.mjs
const TOUCH_MARGIN = 0.15;
const REACH = 6;
const CEIL = 0.26, FLOOR = 0.20;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lookToleranceNow = (r, d) => clamp(Math.atan2(r, Math.max(0.35, d)), FLOOR, CEIL);

/** CANDIDATE A — the same atan2, with the clamp removed.
 *  This is the obvious fix and section 3 shows IT IS NOT ENOUGH. */
const lookToleranceUnclamped = (r, d) => Math.atan2(r, Math.max(0.35, d));

/** Offered, for a player at along-distance `s` from the spot with lateral
 *  offset `lat`, walking straight in and looking where they are going.
 *
 *  `tol` returning null means "this candidate is not an angle rule at all" —
 *  candidate B below tests a DISTANCE, not an angle, and forcing it through an
 *  angle-shaped hole is how the wrong shape survived in the first place. */
const offeredAt = (r, s, lat, rule, reach) => {
  const d = Math.hypot(s, lat);
  const offAxis = Math.atan2(Math.abs(lat), s);
  const touching = d < r + TOUCH_MARGIN;
  const looked = d < reach && rule(r, d, offAxis);
  return { d, on: touching || looked };
};

// The three rules, in the one signature `offeredAt` uses.
const RULE_NOW       = (r, d, a) => a < lookToleranceNow(r, d);
const RULE_UNCLAMPED = (r, d, a) => a < lookToleranceUnclamped(r, d);
/** CANDIDATE B — THE ONE THAT IS ACTUALLY THE RIGHT SHAPE.
 *
 *  `d·sin(offAxis)` is the PERPENDICULAR distance from the spot to the ray the
 *  player is looking along. Requiring it to be under `r` is, in words, "the
 *  spot is within its own radius of my line of sight" — a true CORRIDOR of
 *  constant half-width r.
 *
 *  Why atan2 is not this: `atan2(r, d)` compares the lateral offset against the
 *  RADIAL distance d, where the corridor needs the AXIAL distance. The two
 *  agree at range and diverge as you close, so the atan2 corridor PINCHES SHUT
 *  right at the door — which is why candidate A still leaves a gap. */
const RULE_CORRIDOR  = (r, d, a) => d * Math.sin(a) < r;

/** Walk the model in from 8 m and return the band edges + any dead gap. */
const band = (r, lat, rule, reach = REACH) => {
  const pts = [];
  for (let s = 8.0; s >= 0.0; s -= 0.002) pts.push(offeredAt(r, s, lat, rule, reach));
  const first = pts.findIndex((p) => p.on);
  if (first < 0) return { ever: false };
  const last = pts.length - 1 - [...pts].reverse().findIndex((p) => p.on);
  const gaps = [];
  let run = null;
  for (let i = first; i <= last; i++) {
    if (!pts[i].on) { if (!run) run = { a: i, b: i }; else run.b = i; }
    else if (run) { gaps.push(run); run = null; }
  }
  return {
    ever: true, firstD: pts[first].d, lastD: pts[last].d,
    gaps: gaps.map((g) => ({ fromD: pts[g.a].d, toD: pts[g.b].d })),
  };
};

// ── 1. DOES THE MODEL REPRODUCE THE WALK? ─────────────────────────────────
//
// NOT against an idealised straight line. The first version of this probe
// compared the model's dead-zone edges against the walked ones assuming the
// player held a perfect lateral offset all the way in, and two rows disagreed
// by 0.13 m — a real disagreement that I nearly explained away as "tangential
// geometry, hard to measure". It was not that. THE PLAYER DOES NOT WALK THE
// LINE HE IS AIMED DOWN: kerbs, the facade cushion and the collider slide the
// trajectory, so the actual perpendicular offset drifts by ~0.1 m over an
// 8 m approach.
//
// So the model is replayed over THE RECORDED TRAJECTORY — the real x, z and
// yaw of every frame — and scored against the real prompt string on that same
// frame. That removes the idealisation entirely and turns "do the edges roughly
// line up" into "does this predicate agree with the world, frame by frame".
//
//   SHOT_URL=http://localhost:4185/ node scripts/approach-band.mjs --dump /tmp/w47-trace.json
//   node scripts/probes/w47-band-model.mjs /tmp/w47-trace.json
import { readFileSync } from 'node:fs';
const TRACE = process.argv[2] ?? '/tmp/w47-trace.json';
let trace;
try { trace = JSON.parse(readFileSync(TRACE, 'utf8')); }
catch { console.error(`no trace at ${TRACE} — run approach-band.mjs --dump ${TRACE} first`); process.exit(2); }

/** Replay a rule over one recorded leg. Returns per-frame agreement.
 *
 *  This is `pickSpot`'s arithmetic against ALL registered spots, not just the
 *  target: the world's prompt names the WINNER, so predicting it means picking
 *  a winner too. Line-of-sight is the one thing not modelled (it needs the
 *  scene), so legs where the two disagree because something was occluded are
 *  visible as disagreements rather than silently absorbed. */
const replay = (leg, spots, rule, reach = REACH) => {
  let agree = 0, total = 0;
  const pred = [];
  for (const [x, z, yaw, txt] of leg.rows) {
    const fx = Math.sin(yaw), fz = -Math.cos(yaw);
    let bestNear = null, bestNearKey = Infinity, bestLook = null, bestLookKey = Infinity;
    for (const s of spots) {
      if (!s.ok) continue;
      const dx = s.x - x, dz = s.z - z;
      const d = Math.hypot(dx, dz);
      if (d > 12) continue;
      const offAxis = d < 1e-4 ? 0 : Math.abs(Math.atan2(fx * dz - fz * dx, fx * dx + fz * dz));
      const touching = d < s.r + TOUCH_MARGIN;
      const looked = d < reach && rule(s.r, d, offAxis);
      if (!touching && !looked) continue;
      if (touching) { if (d < bestNearKey) { bestNearKey = d; bestNear = s; } }
      else { const k = offAxis + d * 0.02; if (k < bestLookKey) { bestLookKey = k; bestLook = s; } }
    }
    const win = bestNear ?? bestLook;
    const predOn = !!win && win.label === leg.label;
    const realOn = txt.includes(leg.label);
    pred.push(predOn);
    total++; if (predOn === realOn) agree++;
  }
  return { agree, total, pred };
};

console.log('1. MODEL vs WALKED WORLD — replayed frame by frame over the REAL trajectory\n');
let agreeAll = 0, totalAll = 0;
const perDoor = new Map();
for (const leg of trace.legs) {
  const { agree, total } = replay(leg, trace.spots, RULE_NOW);
  agreeAll += agree; totalAll += total;
  const e = perDoor.get(leg.door) ?? { a: 0, t: 0 };
  e.a += agree; e.t += total; perDoor.set(leg.door, e);
}
for (const [door, e] of perDoor) {
  const pct = (100 * e.a / e.t);
  console.log(`   ${door.padEnd(16)} ${e.a}/${e.t} frames  ${pct.toFixed(1)}%${pct < 97 ? '   <-- ' : ''}`);
}
const pctAll = 100 * agreeAll / totalAll;
console.log(`\n   OVERALL ${agreeAll}/${totalAll} frames = ${pctAll.toFixed(2)}% agreement.`);
console.log(`   The residue is line-of-sight, which this model does not have (it needs the`);
console.log(`   scene) — fp.ts filters candidates through a raycast and those frames read as`);
console.log(`   "predicted offered, actually not". ${pctAll > 95 ? 'The model IS the world\'s predicate.' : 'MODEL REJECTED.'}\n`);
if (pctAll <= 95) { console.log('   Nothing below is trustworthy.\n'); process.exit(1); }

// Idealised-line edges, kept only for the r-invariance argument in section 2.
const MEASURED = [
  ['SEVENS', 1.05, 1.0, 3.84, 1.24], ['DINER', 1.05, 1.0, 3.83, 1.27],
  ['BURGER BARN', 1.05, 1.0, 3.78, 1.21], ['LIBRARY', 1.60, 1.0, 3.87, 1.79],
  ['BODEGA', 1.80, 1.0, 3.84, 2.00],
];
const outers = MEASURED.map((m) => m[3]);

// ── 2. WHERE THE GAP COMES FROM ───────────────────────────────────────────
//
// The tell is in the table above and it is decisive: the dead zone's OUTER edge
// sits at ~3.8 m for r=1.05, r=1.60 AND r=1.80 alike. It does not move with the
// spot's radius at all. Nothing that depends on `r` can produce that; only a
// CONSTANT does. That constant is the 0.26 rad ceiling.
console.log('2. THE OUTER EDGE DOES NOT MOVE WITH r — so it is not the atan2, it is the clamp\n');
const spreadWalked = Math.max(...outers) - Math.min(...outers);
for (const r of [1.05, 1.2, 1.6, 1.8]) {
  const b = band(r, 1.0, RULE_NOW);
  const g = b.gaps[0];
  // the cone's lateral half-width, which is what actually gates you
  console.log(`   r=${String(r).padEnd(5)} dead ${g.fromD.toFixed(2)} → ${g.toD.toFixed(2)} m ` +
    `· cone half-width at 3.8 m = ${(3.8 * Math.tan(CEIL)).toFixed(2)} m (independent of r)` +
    ` · touch disc = ${(r + TOUCH_MARGIN).toFixed(2)} m`);
}
console.log(`\n   WALKED, at lat 1.0, r running 1.05 → 1.80: the outer edge moved ${spreadWalked.toFixed(2)} m`);
console.log(`   in total while the inner edge moved ${(1.95 - 1.20).toFixed(2)} m. The outer edge is not a`);
console.log(`   function of r at all. Only a constant can do that, and the constant is 0.26 rad.\n`);
console.log(`   A CONSTANT ANGLE IS A CONE, AND A CONE CLOSES AS YOU APPROACH:`);
console.log(`   lateral half-width = d·tan(15°) = 0.266·d, which goes to ZERO at the door,`);
console.log(`   while the aim-free "touching" disc only ever reaches r+0.15. Between them:`);
console.log(`   too far to touch, too far off-axis to aim. Walking in crosses it.\n`);
console.log(`   The UNCLAMPED atan2(r, d) is a CORRIDOR of constant half-width r — it is`);
console.log(`   already the right shape, and the clamp is what bends it into a cone.\n`);

// ── 3. THE FIX, RUN THROUGH THE VALIDATED MODEL ───────────────────────────
//
// Two changes, and they answer the user's two complaints separately:
//   (a) drop the clamp  -> the corridor stops closing -> band is contiguous
//   (b) bring the reach in for street doors -> the far offer goes away
console.log('3. TWO CANDIDATE FIXES, THROUGH THE VALIDATED MODEL\n');
const LATS = [0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
const RADII = [1.05, 1.2, 1.4, 1.6, 1.8];
const trial = (name, rule, reach) => {
  let gaps = 0, cells = 0;
  const lines = [];
  for (const r of RADII) {
    const row = LATS.map((lat) => {
      const b = band(r, lat, rule, reach);
      cells++;
      if (!b.ever) return 'never';
      if (b.gaps.length) { gaps++; return ' GAP ';
      }
      return `${b.firstD.toFixed(1)}m`.padStart(5);
    }).join(' ');
    lines.push(`     r=${String(r).padEnd(5)} ${row}`);
  }
  console.log(`   ${name}   (reach ${reach} m)`);
  console.log(`     lat →  ${LATS.map((l) => String(l).padStart(5)).join(' ')}`);
  for (const l of lines) console.log(l);
  console.log(`     -> ${gaps ? `${gaps}/${cells} lanes STILL HAVE A GAP` : `all ${cells} lanes contiguous`}\n`);
  return gaps;
};

trial('A: unclamped atan2(r, d)          ', RULE_UNCLAMPED, 6);
console.log('   Candidate A FAILS, and the reason is worth having: atan2(r, d) measures the');
console.log('   lateral offset against the RADIAL distance d, where a corridor needs the');
console.log('   AXIAL one. As you close on the door those diverge, so the corridor pinches');
console.log('   shut in the last metre — a smaller gap in the same place. Removing the clamp');
console.log('   is the obvious fix and it is not sufficient.\n');

const gapsB = trial('B: perpendicular offset < r        ', RULE_CORRIDOR, 6);
console.log('   Candidate B is contiguous everywhere, and PROVABLY so rather than by luck:');
console.log('   walking a straight line with a fixed perpendicular offset p, the test');
console.log('   `p < r` does not depend on how far along the line you are. So the offer');
console.log('   cannot switch off mid-approach. Either the lane is inside the corridor and');
console.log('   the door is offered from `reach` all the way in, or it never is and you');
console.log('   walked past a door 1.5 m to your side — which is correct, not a gap.\n');

// ── 4. THE FAR OFFER, which candidate B alone does NOT fix ────────────────
console.log('4. THE SECOND HALF OF HIS SENTENCE — the far offer\n');
console.log('   *"there\'s like a distance far away i can enter (i dont like this)"*.');
console.log('   Measured today: every one of the 12 doors is offered from 5.85–6.00 m.');
console.log('   That is `reach = 6` (fp.ts:732, the default argument) and nothing else —');
console.log('   note the FLOOR of the clamp makes it worse, holding the cone open to 0.20 rad');
console.log(`   at 6 m (${(6 * Math.tan(FLOOR)).toFixed(2)} m of lateral width) where the honest atan2 would give`);
console.log(`   ${Math.atan2(1.05, 6).toFixed(3)} rad (${(6 * Math.tan(Math.atan2(1.05, 6))).toFixed(2)} m). The clamp is two-sided and BOTH sides are wrong:`);
console.log('   the ceiling closes the corridor at the door (his dead band), the floor holds');
console.log('   it open across the street (his far offer).\n');
for (const reach of [6, 4, 3]) {
  const b = band(1.05, 0, RULE_CORRIDOR, reach);
  console.log(`     reach ${reach} m -> a door of r 1.05 is offered from ${b.firstD.toFixed(2)} m`);
}
console.log('\n   WHICH REACH IS A QUESTION FOR HIM, NOT FOR ME. `reach` is a pickSpot');
console.log('   parameter and interiors pass the same 6 m deliberately — "6 m is a room\'s');
console.log('   width" (fp.ts:729). Cutting it globally to suit street doors would pull every');
console.log('   interior [E] in with it. The safe form is a per-spot reach defaulting to 6,');
console.log('   with street entrances opting into something shorter. Not measured here, and');
console.log('   flagged as the open half of item 98.\n');
process.exit(gapsB ? 1 : 0);
