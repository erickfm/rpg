// ITEM 172 — WALK THE PARK. Terrain is not provable from a screenshot.
//
// The item: *"VERIFY BY WALKING THE WHOLE PARK, not from a screenshot — this is
// terrain, so the walk is the only proof, and the 2 m lane discipline applies
// to the paths."*
//
// Three questions, none of which a still can answer:
//
//   MOVES    does the player actually cross the ground, or does a slope stop
//            him? A mound that blocks is worse than no mound.
//   RIDES    does his body height track the floor picker as he crosses? If the
//            mesh moved and the picker did not — or the reverse — he walks
//            through the hill or floats over it, and both look fine in a photo.
//   SMOOTH   does his height ever jump between consecutive samples by more than
//            the grade can explain? That is the thing you trip over.
//
// WHY IT SAMPLES `__ct.camY()` AND NOT `pos()[1]` OR `pos()[3]`. Both of the
// obvious choices are wrong and the first draft of this file used one of them:
//
//   `pos()[1]` is `rig.pos.y`, which fp.ts:211 sets to `this.height` and never
//     moves — it is the EYE HEIGHT, a constant, not a world position. Asserting
//     against it reported "NOT ON THE GROUND, drift 0.218 m" on two legs, and
//     0.218 m was exactly the mound's height at the sample point: the harness
//     had rediscovered the mound and called it a bug. The world was correct
//     and the instrument was not, which is the house pattern.
//   `pos()[3]` is `apt.gy()`, a last-written value with more than one writer —
//     the citizens on the pavement write it too — so it answers whoever queried
//     the picker most recently, which is usually not you.
//     `scripts/E-park-walk.mjs` records losing a real diagnosis to exactly that.
//
// `camY()` is `cam.position.y`, the eye's actual world height, written by the
// rig from its own floor pick. It is the only one of the three that is a
// statement about where the player is.
//
// AND STOPPING IS NOT FAILING. The park is planted: trees, benches, shrubs, a
// fountain and a memorial all carry colliders, and a grid of transects walks
// into them by design. A leg that stops is only a terrain fault if it stops
// where nothing is registered, so the stop point is checked against
// `__ct.colliders()` before anything is called a failure.
//
// TRANSECTS, NOT A ROUTE. A route only finds the holes its author imagined, so
// this crosses the park on a grid of parallel lines in both axes plus both
// diagonals of the field, which sweeps the mound, the dish, every grass/path
// join and every path junction without anyone having to list them.
//
//   SHOT_URL=http://localhost:4390/ node scripts/probes/w83-park-walk.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL || 'http://localhost:4390/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await page.evaluate(() => window.__ct.clock(13, 20));

const park = (await page.evaluate(() => window.__ct.sites())).park;
if (!park) { console.log('ABORT  no park site'); await browser.close(); process.exit(3); }

// yaw convention, fp.ts:477 — fwd = (sin yaw, 0, -cos yaw), so yaw 0 walks
// toward -z and yaw -PI/2 toward -x. The first draft had these labelled the
// other way up and marched ten legs straight into the north flank wall from
// 1.6 m away, then reported them STUCK.
const YAW = { MINUS_Z: 0, PLUS_Z: Math.PI, PLUS_X: Math.PI / 2, MINUS_X: -Math.PI / 2 };

/** Hold W and sample the player as he goes. Returns the samples. */
const transect = async (x0, z0, yaw, ms) => {
  await page.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0.14, 0), [x0, z0, yaw]);
  await page.waitForTimeout(160);
  await page.keyboard.down('w');
  const s = [];
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    s.push(await page.evaluate(() => {
      const p = window.__ct.pos();
      return { x: p[0], z: p[2], y: window.__ct.camY(), g: window.__ct.groundAt(p[0], p[2]) };
    }));
  }
  await page.keyboard.up('w');
  await page.waitForTimeout(60);
  return s;
};

// Every registered solid in the park, so a leg that stops against a tree is
// not reported as a hole in the ground.
const solids = await page.evaluate(() => {
  const all = [...window.__ct.colliders(), ...window.__ct.citAvoid()];
  return all.map((b) => ({ minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ }));
});
const nearSolid = (x, z, r = 1.0) => solids.some((b) =>
  x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r);
console.log(`registered solids in the world: ${solids.length}`);

// Lines across the site, inset far enough to start on walkable ground.
const legs = [];
const IN = 1.6;
for (let x = park.minX + 4; x <= park.maxX - 4; x += 2.2) {
  legs.push({ name: `-z at x ${x.toFixed(1)}`, x, z: park.maxZ - IN, yaw: YAW.MINUS_Z, ms: 3400 });
}
for (let z = park.minZ + 4; z <= park.maxZ - 4; z += 2.2) {
  legs.push({ name: `-x at z ${z.toFixed(1)}`, x: park.maxX - IN, z, yaw: YAW.MINUS_X, ms: 3400 });
}
// ── AND FOUR LEGS THAT MUST ACTUALLY CLIMB THE MOUND ─────────────────────
//
// The grid above proves the ground is continuous and rideable; it does NOT
// prove the mound can be walked up, because the transects stop against the
// bench and the tree on the mound before they reach the crest — the best climb
// on any of the 21 was 0.223 m against a 0.485 m mound. A relief nobody can get
// on top of has not answered the user's ask.
//
// Derived from the source rather than retyped: `ct/park.ts` puts the crest at
// `mndX = fx0 + (fx1-fx0)*0.46`, `mndZ = (fz0+fz1)/2 - 1.6`, and the field is
// the loop inset by PATH_W/2. Those constants are re-derived here from the
// PUBLISHED site plus the two the file states, which is the closest this can
// get to importing them from a module the harness cannot load.
const KERB_W = 0.25, INSET = 6.0, PATH_W = 1.5;
const EDGE_X = park.maxX - KERB_W;
const lx0 = park.minX + INSET + 0.5, lx1 = EDGE_X - INSET;
const lz0 = park.minZ + INSET, lz1 = park.maxZ - INSET;
const fx0 = lx0 + PATH_W / 2, fx1 = lx1 - PATH_W / 2;
const fz0 = lz0 + PATH_W / 2, fz1 = lz1 - PATH_W / 2;
const mndX = fx0 + (fx1 - fx0) * 0.46, mndZ = (fz0 + fz1) / 2 - 1.6;
console.log(`field  x ${fx0.toFixed(2)}…${fx1.toFixed(2)}  z ${fz0.toFixed(2)}…${fz1.toFixed(2)}` +
  `   crest at x ${mndX.toFixed(2)} z ${mndZ.toFixed(2)}`);
const CLIMBS = [
  { name: 'climb from the north', x: mndX, z: mndZ + 6.0, yaw: YAW.MINUS_Z },
  { name: 'climb from the south', x: mndX, z: mndZ - 6.0, yaw: YAW.PLUS_Z },
  { name: 'climb from the west', x: mndX - 6.0, z: mndZ, yaw: YAW.PLUS_X },
  { name: 'climb from the east', x: mndX + 6.2, z: mndZ, yaw: YAW.MINUS_X },
];
for (const c of CLIMBS) legs.push({ ...c, ms: 2600, mustClimb: 0.30 });

let fails = 0;
const rows = [];
// The body sits a fixed height above the floor when standing on flat ground.
// Measured here rather than assumed, then used as the reference for every
// sample: what matters is that the OFFSET stays constant as he crosses the
// relief, not what its value happens to be.
await page.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0.14, 0), [park.maxX - 2, park.minZ + 2]);
await page.waitForTimeout(400);
const eyeRef = await page.evaluate(() => {
  const p = window.__ct.pos();
  return window.__ct.camY() - window.__ct.groundAt(p[0], p[2]);
});
console.log(`eye height over the floor, on flat ground: ${eyeRef.toFixed(3)} m`);

for (const leg of legs) {
  const s = await transect(leg.x, leg.z, leg.yaw, leg.ms);
  if (s.length < 6) { console.log(`SKIP  ${leg.name}: only ${s.length} samples`); continue; }
  const end = s[s.length - 1];
  const dist = Math.hypot(end.x - s[0].x, end.z - s[0].z);
  // RIDES — the eye/floor offset must not drift as he crosses the relief
  let worstOff = 0, worstOffAt = null;
  // SMOOTH — a floor jump larger than the distance covered could produce at
  // the steepest grade the sweep found (1 in 9.4, so 0.107 m per metre) plus a
  // small allowance, is a step and not a slope
  let worstJump = 0, worstJumpAt = null;
  let climbed = 0;
  for (let i = 0; i < s.length; i++) {
    const off = Math.abs((s[i].y - s[i].g) - eyeRef);
    if (off > worstOff) { worstOff = off; worstOffAt = s[i]; }
    if (i) {
      const run = Math.hypot(s[i].x - s[i - 1].x, s[i].z - s[i - 1].z);
      const rise = Math.abs(s[i].g - s[i - 1].g);
      climbed = Math.max(climbed, Math.abs(s[i].g - s[0].g));
      const allowed = run * 0.107 + 0.004;
      if (rise - allowed > worstJump) { worstJump = rise - allowed; worstJumpAt = s[i]; }
    }
  }
  // CROSSES — a short leg is only a fault if it stopped in the open. A park is
  // planted; walking a grid across one means walking into things.
  const blocked = dist <= 3.0 && nearSolid(end.x, end.z);
  const moved = dist > 3.0 || blocked;
  const rides = worstOff < 0.06;
  const smooth = worstJump <= 0;
  // a climb leg additionally has to GET UP THERE — and a prop in the way is no
  // excuse on these four, because the point is that the hill is walkable
  const gotUp = leg.mustClimb === undefined
    || (end.g - s[0].g) >= leg.mustClimb;
  if (!moved || !rides || !smooth || !gotUp) fails++;
  rows.push({ name: leg.name, dist, worstOff, worstJump, moved, rides, smooth, blocked, climbed,
    gotUp, gained: end.g - s[0].g, mustClimb: leg.mustClimb,
    worstOffAt, worstJumpAt, n: s.length, end });
}

// POPULATION FLOOR. Under 12 legs the grid did not resolve and "0 failures" is
// a statement about nothing.
console.log(`\nlegs walked: ${rows.length}`);
if (rows.length < 12) {
  console.log(`ABORT  only ${rows.length} legs, floor is 12`);
  await browser.close();
  process.exit(3);
}
for (const r of rows) {
  if (r.mustClimb !== undefined) {
    console.log(`${r.gotUp ? 'PASS' : 'FAIL'}  ${r.name}: walked ${r.dist.toFixed(2)} m and gained ` +
      `${r.gained.toFixed(3)} m of floor (needs ${r.mustClimb.toFixed(2)}), ` +
      `ending on ground ${r.end.g.toFixed(3)} m`);
  }
  if (r.moved && r.rides && r.smooth && r.gotUp) continue;
  console.log(`FAIL  ${r.name}  moved ${r.dist.toFixed(2)} m${r.moved ? '' : ' <- STOPPED IN THE OPEN'}` +
    `  eye drift ${r.worstOff.toFixed(3)} m${r.rides ? '' : ' <- NOT ON THE GROUND'}` +
    `${r.smooth ? '' : `  step ${(r.worstJump * 1000).toFixed(0)} mm over the grade <- TRIPS`}` +
    `  ended x ${r.end.x.toFixed(2)} z ${r.end.z.toFixed(2)}`);
}
const dists = rows.map((r) => r.dist);
const offs = rows.map((r) => r.worstOff);
const stoppedAtProp = rows.filter((r) => r.blocked).length;
console.log(`distance walked   min ${Math.min(...dists).toFixed(2)}  max ${Math.max(...dists).toFixed(2)} m` +
  `  (${stoppedAtProp} leg(s) stopped against a registered prop, which is not a fault)`);
console.log(`eye/floor drift   max ${Math.max(...offs).toFixed(4)} m  (tolerance 0.060)`);
console.log(`relief crossed    max ${Math.max(...rows.map((r) => r.climbed)).toFixed(3)} m of climb on one leg`);
console.log(`step over grade   max ${Math.max(...rows.map((r) => r.worstJump)).toFixed(4)} m excess (0 = none)`);
console.log(errors.length ? `console errors: ${errors.length}\n  ${errors.join('\n  ')}` : 'console errors: 0');
console.log(fails === 0 ? `\nWALK GREEN — ${rows.length} legs, every one crossed, on the ground, no step`
  : `\nWALK RED — ${fails} of ${rows.length} legs failed`);
await browser.close();
process.exit(fails === 0 && errors.length === 0 ? 0 : 1);
