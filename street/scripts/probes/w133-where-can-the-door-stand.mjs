// WHERE CAN 301's ROOM-SIDE DOOR STAND-POINT GO? — a search, not a guess.
//
// Item 308. The calendar has to come back to the RIGHT (AX(-0.80) = x 199.20),
// which puts a reading stand-point in the south-east strip — the only standable
// floor in front of the right-hand half of the south wall. The door's own
// stand-point is in that strip today, so it has to leave it.
//
// Constraints, every one of them read off `__ct` rather than retyped:
//   · standable         — outside every collider padded by the player's RADIUS
//   · clear of the swing — at least LEAF + RADIUS from the leaf's pivot, so the
//     opening leaf never sweeps the capsule of a player standing on the spot
//   · 2 * RADIUS from every rank-0 stand-point in the room (sleep, calendar),
//     which is what scripts/standpoint-overlap.mjs enforces
//   · 1.10 m from the BED seat, which is 2*RADIUS plus what `w40-bed-vs-door`
//     needs to exist: it warps onto the door spot and walks to the bed, and
//     asserts that walk covered more than 0.60 m to within 0.30 m of the bed.
//
// SCORED by how much of the doorway approach stays inside the spot's aim-free
// touch circle (r + TOUCH_MARGIN) — because when you walk at the door to leave,
// the stand-point is BEHIND you and `looked` is false, so `touching` is the
// only thing that can offer you the door.
//
//   SHOT_URL=http://localhost:4186/ node scripts/probes/w133-where-can-the-door-stand.mjs --cal=199.20,-17.40
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
  spots: window.__ct.spots().filter((s) => s.ok && s.x > 196 && s.x < 200 && s.z > -19 && s.z < -13)
    .map((s) => ({ label: s.label, x: s.x, z: s.z, r: s.r, rank: s.rank ?? 0 })),
  cols: window.__ct.staticColliders()
    .filter((c) => c.maxX > 196.5 && c.minX < 200.1 && c.maxZ > -18.2 && c.minZ < -14.3)
    .map((c) => ({ minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ })),
}));
await b.close();

const R = W.R, TM = W.TM;
const PIV = { x: 199.91, z: -16.005 };     // leaf301, measured by w133-301-floor
const LEAF = 0.99;                          // FLAT_LEAF_W, apartment.ts
const DOOR_R = 0.95;                        // the spot's registered radius today

const standable = (x, z) => !W.cols.some((c) =>
  x > c.minX - R && x < c.maxX + R && z > c.minZ - R && z < c.maxZ + R);

// THE APPROACH: every standable cell in front of the opening — the floor a
// player crosses on his way out of the flat. z is the opening's own span,
// widened by the player's radius at each end.
const approach = [];
for (let x = 198.9; x <= 199.6; x += 0.02)
  for (let z = -17.35; z <= -15.95; z += 0.02)
    if (standable(x, z)) approach.push({ x, z });

const bed = W.spots.find((s) => /bed/i.test(s.label));
const argCal = process.argv.find((a) => a.startsWith('--cal='));
const CAL = argCal ? argCal.slice(6).split(',').map(Number) : null;
const keepOut = W.spots.filter((s) => s.rank === 0 && !/bed|calendar/i.test(s.label))
  .map((s) => ({ label: s.label, x: s.x, z: s.z }));
keepOut.push(CAL
  ? { label: 'read the calendar (proposed)', x: CAL[0], z: CAL[1] }
  : W.spots.find((s) => /calendar/i.test(s.label)));

console.log(`RADIUS ${R}  TOUCH_MARGIN ${TM} -> a door spot r${DOOR_R} reaches ${(DOOR_R + TM).toFixed(2)} m`);
console.log(`leaf pivot (${PIV.x}, ${PIV.z}), leaf ${LEAF} -> clear of the swing at ${(LEAF + R).toFixed(2)} m`);
console.log(`bed seat (${bed.x}, ${bed.z}); keep-out: ${keepOut.map((k) => `"${k.label}" (${k.x.toFixed(2)},${k.z.toFixed(2)})`).join(', ')}`);
console.log(`the approach is ${approach.length} standable cells at 2 cm\n`);

const score = (x, z) => {
  let worst = 0;
  for (const a of approach) worst = Math.max(worst, Math.hypot(x - a.x, z - a.z));
  return worst;
};
console.log(`TODAY's spot (199.36, -17.455): worst approach cell is ${score(199.36, -17.455).toFixed(3)} m `
  + `away (reach ${(DOOR_R + TM).toFixed(2)})\n`);

const cands = [];
for (let x = 197.0; x <= 199.9; x += 0.01) {
  for (let z = -17.9; z <= -14.4; z += 0.01) {
    if (!standable(x, z)) continue;
    if (Math.hypot(x - PIV.x, z - PIV.z) < LEAF + R) continue;
    if (Math.hypot(x - bed.x, z - bed.z) < 1.10) continue;
    if (keepOut.some((k) => Math.hypot(x - k.x, z - k.z) < 2 * R)) continue;
    cands.push({ x, z, worst: score(x, z) });
  }
}
cands.sort((a, c) => a.worst - c.worst);
console.log(`${cands.length} cells satisfy every constraint. Best coverage of the approach:`);
for (const q of cands.slice(0, 15)) {
  console.log(`  (${q.x.toFixed(2)}, ${q.z.toFixed(2)})  worst approach cell ${q.worst.toFixed(3)} m  `
    + `${q.worst < DOOR_R + TM ? 'COVERED' : `NEEDS r >= ${(q.worst - TM).toFixed(2)}`}`);
}
if (!cands.length) console.log('  NONE — the constraints as stated have no solution.');
