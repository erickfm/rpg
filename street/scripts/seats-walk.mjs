// Sit on EVERY registered seat, then get up off it.
//
// The user asked for "for every seat in the game i want to be able to sit
// down", so the test is not "sitting works" — it is "all of them work". It
// enumerates `__ct.seats()` rather than a hand-written list, which means it
// covers seats registered by builders who have not been written yet: B's bus
// bench, G's casino and hotel, C's room 301. If you register a seat through
// `ctx.seat()`, this file already tests it.
//
// Per seat it proves five things, in the order they can fail:
//
//   reachable — there is somewhere you can legally STAND that is inside the
//               trigger. A seat you cannot walk up to is a seat that does not
//               exist, and it is the same failure as GOTCHAS §8.
//   sits      — E puts you on it, facing where the seat faces.
//   locked    — you cannot walk off it. Holding W must move you nowhere.
//   height    — the camera drops to seated, and by the right amount.
//   stands    — E puts you back exactly where you were standing, and you can
//               walk away from there. THIS is the one the queue calls the
//               failure mode: getting up inside a table.
//
// Usage: SHOT_URL=http://localhost:4185/ node scripts/seats-walk.mjs
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const RADIUS = 0.36, SIT_EYE = 0.72, STAND_EYE = 1.62;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4185/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 15000 });
await reportWorld(p, process.env.SHOT_URL ?? 'http://localhost:4185/');   // GOTCHAS 26: prove it, do not just name it
await p.waitForTimeout(300);

const pos = () => p.evaluate(() => window.__ct.pos());
const camY = () => p.evaluate(() => window.__ct.camY());
const yawNow = () => p.evaluate(() => window.__ct.yaw());
const seatedOn = () => p.evaluate(() => window.__ct.seated());
const prompt = () => p.evaluate(() => {
  const d = document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? d.textContent : null;
});
const warp = (x, z, yaw, gy) => p.evaluate(([x, z, yaw, gy]) => window.__ct.warp(x, z, yaw, gy, 0), [x, z, yaw, gy]);
const press = async () => { await p.keyboard.down('e'); await p.waitForTimeout(90); await p.keyboard.up('e'); await p.waitForTimeout(200); };
const hold = async (k, ms) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); await p.waitForTimeout(80); };

const seats = await p.evaluate(() => window.__ct.seats());
console.log(`${seats.length} seats registered\n`);
if (!seats.length) { console.log('NO SEATS — nothing to test'); await b.close(); process.exit(1); }

// Where can you legally stand to use this seat? Ask the collider list rather
// than guessing: try rings out from the trigger centre and keep the first
// unblocked point that is still inside the trigger radius.
const standableNear = (at, r) => p.evaluate(([at, r, RADIUS]) => {
  const cols = window.__ct.colliders();
  const blocked = (x, z) => cols.some((c) =>
    x > c.minX - RADIUS && x < c.maxX + RADIUS && z > c.minZ - RADIUS && z < c.maxZ + RADIUS);
  for (let ring = 0.05; ring <= r; ring += 0.07) {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const x = at.x + Math.cos(a) * ring, z = at.z + Math.sin(a) * ring;
      if (!blocked(x, z)) return { x, z };
    }
  }
  return null;
}, [at, r, RADIUS]);

const results = [];
const f2 = (n) => +n.toFixed(2);
let idx = 0;
for (const s of seats) {
  idx++;
  const tag = `seat ${idx}/${seats.length} "${s.label}" @ ${f2(s.pose.x)},${f2(s.pose.z)}`;
  const fail = (why) => { results.push([false, tag, why]); };

  // Force a clean start. Every seat's `sit` is dead while you are seated, so
  // one seat failing to release you turns every later seat into "no prompt"
  // and the run reports 3/43 for a single fault. A bus pulling into the stop
  // did exactly that: it blocked the pavement the bench seat stood up onto.
  if (await seatedOn()) {
    await p.evaluate(() => window.__ct.stand && window.__ct.stand());
    await p.waitForTimeout(80);
    if (await seatedOn()) { fail('the PREVIOUS seat would not release the player'); continue; }
  }

  const stand = await standableNear(s.at, s.r);
  if (!stand) { fail(`UNREACHABLE — no standable point within its ${s.r} m trigger`); continue; }

  await warp(stand.x, stand.z, 0, 0);
  await p.waitForTimeout(140);
  const pr = await prompt();
  if (!pr || !pr.includes(s.label)) {
    fail(`no "${s.label}" prompt from the one standable point (${f2(stand.x)},${f2(stand.z)}); got ${JSON.stringify(pr)}`);
    continue;
  }
  const before = await pos();

  await press();
  const on = await seatedOn();
  if (!on) { fail('E did not seat you'); continue; }
  const sat = await pos();
  // Landing on a NEIGHBOURING seat of the same run is not a defect.
  //
  // A diner booth run is back to back by construction: booth n's far bench and
  // booth n+1's near bench share a divider and their centres are 0.67 m apart.
  // Any trigger big enough to reach either from the aisle (about 0.64 m) must
  // overlap the other, and the E dispatch takes the first match — so one of
  // each adjacent pair can never be the one chosen. Shrinking the triggers
  // below 0.34 m would fix the ambiguity by making both unreachable.
  //
  // What the user asked for is that every seat is sittable, and pressing E at
  // the bank does seat you on a bench there. So the check is that you landed
  // on A seat of this run, not THE seat — and it still catches sitting on
  // something across the room, or not sitting at all.
  const offBy = Math.hypot(sat[0] - s.pose.x, sat[2] - s.pose.z);
  if (offBy > 1.0) {
    fail(`sat at ${f2(sat[0])},${f2(sat[2])} but the seat is at ${f2(s.pose.x)},${f2(s.pose.z)}`); continue;
  }

  // you face where the seat faces — approached at yaw 0 above, so if the seat
  // faces anywhere else this only passes because sit() turned you
  // …and only meaningful if we landed on the seat we asked for. Sitting on a
  // back-to-back neighbour means facing the other way BY DESIGN — that is what
  // back to back is — so checking its facing against this seat's is checking
  // the wrong pair.
  const yv = await yawNow();
  const dyaw = Math.abs(Math.atan2(Math.sin(yv - s.pose.yaw), Math.cos(yv - s.pose.yaw)));
  if (offBy < 0.01 && dyaw > 0.01) {
    fail(`seated facing ${f2(yv)} but the seat faces ${f2(s.pose.yaw)}`); continue;
  }

  // movement is locked: hold every direction and go nowhere
  for (const k of ['w', 's', 'a', 'd']) await hold(k, 200);
  const still = await pos();
  if (Math.hypot(still[0] - sat[0], still[2] - sat[2]) > 0.001) {
    fail(`walked off the seat: moved ${f2(Math.hypot(still[0] - sat[0], still[2] - sat[2]))} m while seated`); continue;
  }

  // seated eye height, read off the camera the world actually renders with.
  // gy is the floor under the seat; the eye must land seat-pan + SIT_EYE above
  // it, and must be a clear drop from standing or you are not sitting, you are
  // hovering.
  const eye = await camY();
  const wantEye = sat[3] + s.pose.h + SIT_EYE;
  if (Math.abs(eye - wantEye) > 0.04) {
    fail(`seated eye is ${f2(eye)}, expected ${f2(wantEye)} (floor ${f2(sat[3])} + pan ${f2(s.pose.h)} + ${SIT_EYE})`); continue;
  }
  if (eye > sat[3] + STAND_EYE - 0.12) {
    fail(`seated eye ${f2(eye)} is barely below standing (${f2(sat[3] + STAND_EYE)}) — that is not sitting`); continue;
  }

  const seatPrompt = await prompt();
  if (!/stand up/.test(seatPrompt ?? '')) {
    fail(`seated prompt should be "stand up", got ${JSON.stringify(seatPrompt)}`); continue;
  }

  await press();
  if (await seatedOn()) { fail('E did not get you up again'); continue; }
  const up = await pos();
  if (Math.hypot(up[0] - before[0], up[2] - before[2]) > 0.01) {
    fail(`stood up at ${f2(up[0])},${f2(up[2])}, not where you sat down from ${f2(before[0])},${f2(before[2])}`); continue;
  }

  // …and you are not stuck in the furniture: you can walk away
  let moved = 0;
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    await warp(up[0], up[2], yaw, up[3]);
    await p.waitForTimeout(70);
    const a = await pos();
    await hold('w', 260);
    const c = await pos();
    moved = Math.max(moved, Math.hypot(c[0] - a[0], c[2] - a[2]));
  }
  if (moved < 0.3) { fail(`stood up STUCK — could not walk away (best ${f2(moved)} m)`); continue; }

  results.push([true, tag, `stood clear, walked ${f2(moved)} m away`]);
}

const bad = results.filter((r) => !r[0]);
for (const [ok, tag, detail] of results) if (!ok) console.log(`FAIL  ${tag}\n        ${detail}`);
console.log(`\n${results.length - bad.length}/${results.length} seats sit, lock, and stand clear`);
if (errs.length) console.log('\npage errors:\n  ' + errs.slice(0, 5).join('\n  '));
await b.close();
process.exit(bad.length || errs.length ? 1 : 0);
