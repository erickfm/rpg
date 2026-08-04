// CAN 301 HOLD A CALENDAR AT AX(-0.80) *AND* A DOOR STAND-POINT AT ALL?
//
// Item 308, and the answer is a search rather than an opinion. Both stand-points
// are unknowns: the calendar's reading spot must sit square in front of the page
// (item 298's rule — *"i can t look at the calendar if im looking right at it"*),
// and the door's may go anywhere the room allows.
//
// Every constraint below is either read off `__ct` or cited to the check that
// enforces it. Nothing is retyped from the source.
//
//   A  |cal - door|  >= 2*RADIUS          scripts/standpoint-overlap.mjs
//   B  |door - bed|  >= 0.95              w40-bed-vs-door STATION 1 warps onto
//                                         the door spot and asserts the walk to
//                                         within 0.30 m of the bed covered >0.60
//   C  |door - sleep| >= 2*RADIUS         standpoint-overlap again
//   D  door standable, and outside the leaf's OPEN box and its SHUT cap
//   E  cal clear of the bed->door segment by RADIUS + TOUCH_MARGIN
//                                         apartment.ts's own rule, and what
//                                         w40's band walk actually measures
//   F  cal standable
//   G  |cal - bed| >= 2*RADIUS            not enforced by any check (both rank 0)
//                                         but the same ambiguity, so wanted
//   H  |door - pivot| >= LEAF + RADIUS    the leaf never sweeps the capsule of a
//                                         player standing on the spot
//
//   SHOT_URL=http://localhost:4186/ node scripts/probes/w133-two-standpoints.mjs [--noswing]
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4186/');
const NOSWING = process.argv.includes('--noswing');
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
    .filter((c) => c.maxX > 196.5 && c.minX < 200.5 && c.maxZ > -18.2 && c.minZ < -14.3)
    .map((c) => ({ minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ })),
}));
await b.close();

const R = W.R, TM = W.TM;
const PIV = { x: 199.91, z: -16.005 }, LEAF = 0.99;
const DOORWAY = { x: 199.85, z: -16.50 };
const CAL_X = 199.20;                       // AX(-0.80) — where the user asked
const bed = W.spots.find((s) => /bed/i.test(s.label));
const sleep = W.spots.find((s) => /sleep/i.test(s.label));
const standable = (x, z) => !W.cols.some((c) =>
  x > c.minX - R && x < c.maxX + R && z > c.minZ - R && z < c.maxZ + R);
// distance from a point to the bed->door segment
const segD = (px, pz, a, c) => {
  const vx = c.x - a.x, vz = c.z - a.z;
  const t = Math.max(0, Math.min(1, ((px - a.x) * vx + (pz - a.z) * vz) / (vx * vx + vz * vz)));
  return Math.hypot(px - (a.x + vx * t), pz - (a.z + vz * t));
};

console.log(`RADIUS ${R}  TOUCH_MARGIN ${TM}  bed seat (${bed.x}, ${bed.z})`);
console.log(`swing rule: ${NOSWING ? 'OFF (the leaf carries no collider mid-swing)' : `door >= ${(LEAF + R).toFixed(2)} m from the pivot`}\n`);

const rows = [];
for (let zc = -17.64; zc <= -16.80; zc += 0.01) {
  if (!standable(CAL_X, zc)) continue;
  const cal = { x: CAL_X, z: zc };
  let best = null;
  for (let x = 197.0; x <= 199.60; x += 0.01) {
    for (let z = -17.80; z <= -14.40; z += 0.01) {
      if (!standable(x, z)) continue;
      if (!NOSWING && Math.hypot(x - PIV.x, z - PIV.z) < LEAF + R) continue;
      if (Math.hypot(x - cal.x, z - cal.z) < 2 * R) continue;
      if (Math.hypot(x - bed.x, z - bed.z) < 0.95) continue;
      if (Math.hypot(x - sleep.x, z - sleep.z) < 2 * R) continue;
      if (segD(cal.x, cal.z, bed, { x, z }) < R + TM) continue;         // E
      const d = Math.hypot(x - DOORWAY.x, z - DOORWAY.z);
      if (!best || d < best.d) best = { x, z, d };
    }
  }
  if (best) rows.push({ zc, ...best, dCalBed: Math.hypot(CAL_X - bed.x, zc - bed.z) });
}
if (!rows.length) { console.log('NO SOLUTION under these constraints.'); process.exit(0); }
rows.sort((a, c) => a.d - c.d);
console.log('cal stand z   ->  best door stand-point (nearest the doorway)');
for (const q of rows.slice(0, 14)) {
  console.log(`  (${CAL_X}, ${q.zc.toFixed(2)})  [${(q.zc + 17.915).toFixed(2)} m off the wall, `
    + `${q.dCalBed.toFixed(2)} m from the bed seat]`
    + `  ->  door (${q.x.toFixed(2)}, ${q.z.toFixed(2)}), ${q.d.toFixed(2)} m from the doorway`);
}
