// 301'S SOUTH-EAST CORNER HOLDS FOUR SPOTS AND IS 2 m² SHORT. Item 308.
//
// The door's stand-point, the slip pushed under the door, the bed's approach
// and (wanted) the calendar's reading spot all want the same floor. This picks
// the placement with the largest MINIMUM slack rather than the first one that
// squeaks past, because every configuration I reached by hand had one pair
// inside a centimetre of failing.
//
// The rules, each cited to what enforces it — none retyped from the source:
//   · a WAY OUT must clear every rank-0 stand-point by 2*RADIUS
//     (scripts/standpoint-overlap.mjs, pairwise)
//   · the BED must clear the door by 0.85 + RADIUS, because the same check
//     SAMPLES a pose 0.85 m from the door on the bed-to-door line and requires
//     the door there; closer than that and the pose is inside the bed's capsule
//   · the calendar's spot must clear the bed-to-door segment by RADIUS +
//     TOUCH_MARGIN (apartment.ts's own rule, and what w40's band walk measures)
//   · everything standable, i.e. outside every collider padded by RADIUS
//   · the door within 1.10 m (r + TOUCH_MARGIN) of the floor in front of the
//     opening, or walking at your own front door offers you nothing
//
//   SHOT_URL=http://localhost:4186/ node scripts/probes/w133-three-standpoints.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4186/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.waitForTimeout(1200);
const gy = await p.evaluate(() => window.__ct.groundAt(199.36, -15.545));
await p.evaluate(([gy]) => window.__ct.warp(199.36, -15.545, 0, gy, 0), [gy]);
await p.waitForTimeout(400);
const W = await p.evaluate(() => ({
  R: window.__ct.playerRadius(), TM: window.__ct.touchMargin(),
  spots: window.__ct.spots().filter((s) => s.x > 196 && s.x < 200.2 && s.z > -19 && s.z < -13)
    .map((s) => ({ label: s.label, x: s.x, z: s.z, r: s.r, rank: s.rank ?? 0, ok: s.ok })),
  cols: window.__ct.staticColliders()
    .filter((c) => c.maxX > 196.5 && c.minX < 200.5 && c.maxZ > -18.2 && c.minZ < -14.3)
    .map((c) => ({ minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ })),
}));
await b.close();

const R = W.R, TM = W.TM;
const CAL_X = 199.20;                                  // AX(-0.80), where he asked
const SEP = 2 * R;                                     // the pairwise rule
const BED_SEP = 0.85 + R;                              // the sampled-pose rule
const MIN_SLACK = Number(process.env.MIN_SLACK ?? 0.12);
const SLIP = W.spots.find((s) => /slip/i.test(s.label));
const BED0 = { x: 198.84, z: -16.30 };   // where the bed's approach was before item 308
const SLEEP = W.spots.find((s) => /sleep/i.test(s.label));
console.log(`RADIUS ${R} TOUCH_MARGIN ${TM}; pairwise ${SEP.toFixed(2)} m, bed-vs-door ${BED_SEP.toFixed(2)} m`);
for (const s of W.spots) console.log(`  spot (${s.x.toFixed(3)}, ${s.z.toFixed(3)}) r${s.r} rank${s.rank} ok=${s.ok}  "${s.label}"`);

const standable = (x, z) => !W.cols.some((c) =>
  x > c.minX - R && x < c.maxX + R && z > c.minZ - R && z < c.maxZ + R);
// the floor in front of the opening that a player crosses on his way out
const approach = [];
for (let x = 199.0; x <= 199.55; x += 0.02)
  for (let z = -16.95; z <= -16.40; z += 0.02)
    if (standable(x, z)) approach.push({ x, z });
const segD = (px, pz, a, c) => {
  const vx = c.x - a.x, vz = c.z - a.z;
  const t = Math.max(0, Math.min(1, ((px - a.x) * vx + (pz - a.z) * vz) / (vx * vx + vz * vz)));
  return Math.hypot(px - (a.x + vx * t), pz - (a.z + vz * t));
};

let best = null;
for (let dx = 198.8; dx <= 199.5; dx += 0.01) {
  for (let dz = -17.0; dz <= -16.1; dz += 0.01) {
    if (!standable(dx, dz)) continue;
    const dSlip = Math.hypot(dx - SLIP.x, dz - SLIP.z);
    if (dSlip < SEP) continue;
    // the door must reach the whole approach without aim: walking AT the door,
    // its stand-point is behind you and only `touching` can offer it
    let worst = 0;
    for (const a of approach) worst = Math.max(worst, Math.hypot(dx - a.x, dz - a.z));
    if (worst > 0.95 + TM) continue;
    for (let zc = -17.60; zc <= -17.10; zc += 0.01) {
      if (!standable(CAL_X, zc)) continue;
      // keep the calendar's own standing disc out of the doorway approach
      if (zc + R > -16.975) continue;
      const dCal = Math.hypot(dx - CAL_X, dz - zc);
      if (dCal < SEP) continue;
      // AND THE THING THE PAIRWISE RULE DOES NOT SAY, which is the actual bug
      // the user reported: the DOOR'S standing disc must not lie across the
      // floor you walk up the page on. Anywhere it does, `onIt` hands you the
      // door however square you are facing the calendar — *"i can t look at the
      // calendar if im looking right at it."* The column is the page's own
      // width of floor, from the wall out to a metre.
      let eats = false;
      for (let z = -17.64; z <= -16.92; z += 0.02)
        if (Math.hypot(dx - CAL_X, dz - z) < R + 0.05) { eats = true; break; }
      if (eats) continue;
      for (let bx = 197.3; bx <= 198.9; bx += 0.01) {
        for (let bz = -16.80; bz <= -16.05; bz += 0.01) {
          if (!standable(bx, bz)) continue;
          const dBed = Math.hypot(dx - bx, dz - bz);
          if (dBed < BED_SEP) continue;
          const dSleep = Math.hypot(bx - SLEEP.x, bz - SLEEP.z);
          if (dSleep < SEP) continue;
          const dRoute = segD(CAL_X, zc, { x: bx, z: bz }, { x: dx, z: dz });
          if (dRoute < R + TM) continue;
          // slack, in metres, of the tightest rule — and a small pull toward
          // the door for the door spot and toward the television for the bed
          const slack = Math.min(dSlip - SEP, dCal - SEP, dBed - BED_SEP,
            dSleep - SEP, dRoute - (R + TM), (0.95 + TM) - worst);
          // EVERY RULE HELD BY AT LEAST A HAND'S BREADTH, and then the placement
          // judged on how it READS: the door as close to its own doorway as that
          // allows, the bed's approach as close as possible to the television's
          // centre line and to the z it has always had.
          if (slack < MIN_SLACK) continue;
          // LEAST DISTURBANCE. The calendar's x is the user's ask and is fixed;
          // everything else should move as little as it can get away with. So
          // the bed's approach is scored on how far it has been dragged from
          // where it has always been, and the door on how far it is from the
          // middle of its own opening.
          const moved = Math.hypot(bx - BED0.x, bz - BED0.z);
          const score = -moved - 0.3 * Math.hypot(dx - 199.60, dz + 16.50);
          if (!best || score > best.score) {
            best = { score, slack, dx, dz, zc, bx, bz, dSlip, dCal, dBed, dSleep, dRoute, worst };
          }
        }
      }
    }
  }
}
if (!best) { console.log('\nNO SOLUTION.'); process.exit(0); }
console.log(`\nbest joint placement, tightest slack ${best.slack.toFixed(3)} m:`);
console.log(`  door     (${best.dx.toFixed(2)}, ${best.dz.toFixed(2)})`);
console.log(`  calendar (${CAL_X.toFixed(2)}, ${best.zc.toFixed(2)})  [${(best.zc + 17.915).toFixed(2)} m off the wall]`);
console.log(`  bed      (${best.bx.toFixed(2)}, ${best.bz.toFixed(2)})  moved ${Math.hypot(best.bx - BED0.x, best.bz - BED0.z).toFixed(2)} m`);
console.log(`  door-slip ${best.dSlip.toFixed(3)} (>= ${SEP.toFixed(2)})   door-cal ${best.dCal.toFixed(3)} (>= ${SEP.toFixed(2)})`);
console.log(`  door-bed  ${best.dBed.toFixed(3)} (>= ${BED_SEP.toFixed(2)})   bed-sleep ${best.dSleep.toFixed(3)} (>= ${SEP.toFixed(2)})`);
console.log(`  calendar off the bed-to-door route ${best.dRoute.toFixed(3)} (>= ${(R + TM).toFixed(2)})`);
console.log(`  furthest approach cell from the door ${best.worst.toFixed(3)} (<= ${(0.95 + TM).toFixed(2)})`);
