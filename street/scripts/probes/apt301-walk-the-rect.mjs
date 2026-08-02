// DOES FLAT 301's REGISTERED RECT MATCH THE WALLS YOU ACTUALLY HIT?
//
// `declareRoom` puts a w/d/cx/cz into `__ct.roomDims()` by hand, from the
// constants the room's own walls are drawn on. That is a claim about geometry,
// and `scripts/seat-facing.mjs`'s rule A trusts it completely — it measures a
// seat's nose-to-wall distance against this rectangle and never touches a
// collider. A rect that is a few centimetres wrong is a check quietly grading
// against the wrong wall.
//
// So WALK it. Warp to the room's registered centre, hold a direction until the
// player stops moving, and compare where he came to rest with the registered
// edge. The player capsule is 0.36 m in radius, so a correct wall stops him
// 0.36 m short of the registered face.
//
// It also proves the second thing the registry now publishes: `RoomDims.y`.
// Warping with gy = 0 into a room three storeys up puts you outside the
// building — which is what `bugsweep.mjs` currently does — so this runs the
// same warp both ways and reports both.
//
//   SHOT_URL=http://localhost:4183/ node scripts/probes/apt301-walk-the-rect.mjs
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4183/';
const CAPSULE = 0.36;                 // player radius, ct/fp.ts
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.roomDims !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await p.waitForTimeout(400);

const R = await p.evaluate(() => window.__ct.roomDims().find((r) => r.id === 'apt301') ?? null);
if (!R) { console.log('FAIL  no apt301 in roomDims()'); await b.close(); process.exit(1); }
console.log(`apt301  w ${R.w}  d ${R.d}  centre (${R.cx}, ${R.cz})  floor y ${R.y}\n`);

const pos = async () => { const a = await p.evaluate(() => window.__ct.pos()); return { x: a[0], y: a[1], z: a[2], gy: a[3] }; };
const camY = () => p.evaluate(() => window.__ct.camY());
const warp = (x, z, yaw, gy) =>
  p.evaluate(([x, z, yaw, gy]) => window.__ct.warp(x, z, yaw, gy, 0), [x, z, yaw, gy]);
const hold = async (k, ms) => {
  await p.keyboard.down(k); await p.waitForTimeout(ms);
  await p.keyboard.up(k); await p.waitForTimeout(120);
};

// ── 1. the floor height the registry publishes is the one that lands you in ──
await warp(R.cx, R.cz, 0, 0);
await p.waitForTimeout(350);
const wrongY = await camY();
await warp(R.cx, R.cz, 0, R.y);
await p.waitForTimeout(350);
const rightY = await camY();
console.log(`warped to the centre with gy 0    → camera y ${wrongY.toFixed(2)}`);
console.log(`warped to the centre with gy ${R.y}  → camera y ${rightY.toFixed(2)}`);
const EYE = rightY - R.y;
const yOK = Math.abs(EYE - 1.62) < 0.25;
console.log(`  eye is ${EYE.toFixed(2)} m above the flat's floor — ${yOK ? 'INSIDE the room' : 'NOT on floor 3'}`);
console.log(`  with gy 0 the camera is ${(rightY - wrongY).toFixed(2)} m lower: outside the building\n`);

// ── 2. walk to each wall and see where it stops you ──
const dirs = [
  { key: 'w', label: '-z  (south wall, the TV end)', axis: 'z', sign: -1, half: R.d / 2 },
  { key: 's', label: '+z  (north wall, past the bed)', axis: 'z', sign: 1, half: R.d / 2 },
  { key: 'a', label: '-x  (west wall, the window)', axis: 'x', sign: -1, half: R.w / 2 },
  { key: 'd', label: '+x  (east wall, your own door)', axis: 'x', sign: 1, half: R.w / 2 },
];
// WHICH DIRECTION OF ERROR IS A DEFECT, and which is just a furnished room.
//
// Rule A asks "how far to this room's own wall along the seat's nose". It is
// wrong only if the declared face is FURTHER OUT than the surface that really
// stops you — then it over-reports the clearance and a nose-to-the-wall seat
// passes. Stopping SHORT of a declared face is what a bed, a TV crate or a
// chest of drawers does, and there is no rect that avoids it in a 3 x 3.4 m
// bedroom you can barely turn round in. So: an overrun fails, an early stop is
// reported and forgiven.
let overrun = 0;
for (const d of dirs) {
  await warp(R.cx, R.cz, 0, R.y);          // yaw 0 = looking -z, so w/s/a/d map to z/x
  await p.waitForTimeout(250);
  let prev = await pos();
  for (let i = 0; i < 12; i++) {
    await hold(d.key, 320);
    const now = await pos();
    if (Math.hypot(now.x - prev.x, now.z - prev.z) < 0.01) { prev = now; break; }
    prev = now;
  }
  const centre = d.axis === 'x' ? R.cx : R.cz;
  const reached = d.axis === 'x' ? prev.x : prev.z;
  const gap = d.half - Math.abs(reached - centre);      // how far short of the face
  const err = gap - CAPSULE;                            // 0 = the wall is exactly where declared
  if (err < 0) overrun = Math.max(overrun, -err);
  const verdict = Math.abs(err) < 0.12 ? 'the bare wall, exactly where declared'
    : err > 0 ? `furniture ${err.toFixed(2)} m short of the wall`
              : `FAIL: walked ${(-err).toFixed(2)} m PAST the declared face`;
  console.log(`${d.label}`);
  console.log(`   stopped at ${d.axis} ${reached.toFixed(2)}, ${gap.toFixed(2)} m short of the declared face — ${verdict}`);
}

// ── 3. and an after-image from the seat, looking where the seat looks ──
// LOOKING, not proving — the fingerprint pair is what proves nothing moved.
// This is here so the room the registry now claims can be eyeballed against
// the room the player is actually in.
const seat = await p.evaluate(() =>
  window.__ct.seats().find((s) => s.label.includes('watch TV'))?.pose ?? null);
if (seat) {
  await warp(seat.x, seat.z, seat.yaw, R.y);
  await p.waitForTimeout(500);
  await p.screenshot({ path: 'shots/probe-apt301-from-the-seat.png' });
  console.log(`\nshots/probe-apt301-from-the-seat.png — (${seat.x.toFixed(2)}, ${seat.z.toFixed(2)}) yaw ${seat.yaw.toFixed(2)}`);
}

if (errs.length) console.log(`\nconsole errors: ${errs.length}\n  ${errs.slice(0, 3).join('\n  ')}`);
await b.close();
console.log(overrun > 0.12
  ? `\nFAIL  the declared rect is ${overrun.toFixed(2)} m too small — you can walk out through a declared wall`
  : `\nno direction walked past a declared face: the rect CONTAINS the room, which is what rule A needs`);
process.exit(yOK && overrun <= 0.12 && errs.length === 0 ? 0 : 1);
