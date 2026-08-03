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
// ── ⚠ "109 of 219 FAILURES" IS A DEAD NUMBER. DO NOT QUOTE IT. ──────────────
//
// That figure was cited all week — in handoffs and in the desk's own reasoning —
// as though it were a backlog of broken seats. It was this file being wrong in
// two places at once, and item 255 blamed the wrong one of them:
//
//   · 85 of the 109 were `seated eye is N, expected N`, and 83 of those were an
//     IDENTICAL 0.350 m, every one of them "sit at the slot". This file read
//     `camY()` after its four 200 ms movement holds — 800 ms after sitting — by
//     which time the world's FOCUS pass (crosstown.ts:1234-1247) had eased the
//     camera down onto the slot's screen, which is the integrated overlay the
//     user asked for. The eye is CORRECT on the first frame. Now read there.
//   · the row blamed the approach yaw. It was not the cause: measured over 28
//     seats, `yaw 0` raised the seat's own prompt 27/28, the same as aiming
//     (scripts/probes/w96-seat-aim-convention.mjs). Approaching aimed is still
//     right — a player does — and it is now done, but it moved almost nothing.
//
// The honest figure is printed at the bottom of every run. Take it from there.
//
// Usage: SHOT_URL=http://localhost:4185/ node scripts/seats-walk.mjs
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { flags } from './lib/flags.mjs';
import { reportWorld } from './lib/which-world.mjs';

const RADIUS = 0.36, SIT_EYE = 0.72, STAND_EYE = 1.62;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(aim('http://localhost:4185/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 15000 });
await reportWorld(p, aim('http://localhost:4185/'));   // GOTCHAS 26: prove it, do not just name it
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

// --selftest: bury one seat's approach in the LIVE collider array and require
// this to go red.
//
// This check has the worst record of any of mine, which is why it gets one.
// It found the [E] dispatch seating players on the wrong bench, and I wrote a
// paragraph explaining why that was unavoidable geometry instead of a bug,
// then loosened the assertion from THE seat to A seat so it would pass. It
// then passed, for three seats, while the player sat somewhere they had not
// chosen. A selftest does not catch that on its own — but a check you have
// never watched fail is one you will argue with, and that is how it went.
// Unknown flags are REFUSED, not ignored — a mistyped `--selftest` would
// otherwise run the ordinary suite and exit 0, reporting a selftest pass for
// a selftest that never ran (GOTCHAS 34 shape one).
const SELFTEST = flags(['--selftest']).selftest;
if (SELFTEST) {
  const v = seats[0];
  await p.evaluate(([x, z]) => window.__ct.colliders().push({
    minX: x - 1.4, maxX: x + 1.4, minZ: z - 1.4, maxZ: z + 1.4 }), [v.pose.x, v.pose.z]);
  console.log(`selftest: buried "${v.label}" at ${v.pose.x.toFixed(2)},${v.pose.z.toFixed(2)}`
    + ' — this MUST now go red');
}

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

  // ── APPROACH THE SEAT AIMED AT IT, THE WAY A PLAYER DOES ────────────────
  //
  // This used to be `warp(stand.x, stand.z, 0, 0)` — every one of 219 seats
  // approached facing due +z, whatever direction the seat was actually in. The
  // world's selection tier is AIMED and reaches 6 m, so a seat the player can
  // plainly walk up to and use was recorded as having "no prompt" purely
  // because the probe stood there looking the wrong way.
  //
  // That produced "109 of 219 FAILURES", a number quoted all week — in handoffs
  // and in the desk's own reasoning — as though it were a backlog of broken
  // seats. It was an artifact of this one argument. Worker ninetynine proved it
  // while confirming item 126: in the diner, the ONE booth that passed was the
  // only one that happens to offer "booth" at yaw 0, while the real world was
  // fine at 13/13.
  //
  // `atan2(dx, dz)` is this world's heading convention (0 faces +z), the same
  // one `ct/crowd.ts` uses for a walker's facing.
  //
  // AIMING ALSO STRENGTHENS THE FACING LEG BELOW, it does not weaken it: at a
  // constant yaw 0, every seat whose own `pose.yaw` happened to be 0 passed that
  // check for free. The bearing from a standable point to the seat is almost
  // never the seat's own facing, so `sit()` really does have to turn you.
  // AIM AT `pose`, THE SEAT — not at `at`. `standableNear` picks its point
  // INSIDE `at`'s radius, so the bearing from there to `at` averages 0.18 m long
  // and is mostly noise; to `pose` it averages 0.70 m and is stable. Measured,
  // scripts/probes/w96-seat-aim-convention.mjs.
  const aim = Math.atan2(s.pose.x - stand.x, s.pose.z - stand.z);
  await warp(stand.x, stand.z, aim, 0);
  await p.waitForTimeout(140);
  const pr = await prompt();
  if (!pr || !pr.includes(s.label)) {
    fail(`no "${s.label}" prompt from the one standable point (${f2(stand.x)},${f2(stand.z)}); got ${JSON.stringify(pr)}`);
    continue;
  }
  const before = await pos();

  // START THE EYE SAMPLER BEFORE THE PRESS. `press()` holds E for 90 ms and then
  // waits another 200 ms, so a trace begun after it returns opens ~290 ms after
  // the seat is taken — and the focus ease is 340 ms, so it had already missed
  // almost all of it. Measured: starting after `press()` still failed 81 slots.
  // Each sample carries whether the rig was seated at the time, so frames from
  // before you sat (standing eye ~1.62) can never be mistaken for a good one.
  await p.evaluate(() => {
    const w = window;
    w.__eyeTrace = [];
    const tick = () => {
      w.__eyeTrace.push([w.__ct.camY(), w.__ct.seated() ? 1 : 0]);
      w.__eyeRAF = requestAnimationFrame(tick);
    };
    tick();
  });
  await press();
  const eyeTrace = await p.evaluate(() => {
    cancelAnimationFrame(window.__eyeRAF);
    return window.__eyeTrace.filter((r) => r[1]).map((r) => r[0]);
  });
  const on = await seatedOn();
  if (!on) { fail('E did not seat you'); continue; }
  // ── READ THE EYE AS YOU SIT, NOT 800 ms LATER ───────────────────────────
  //
  // This check used to call `camY()` down at the bottom, AFTER the four 200 ms
  // movement holds. That is 800 ms after sitting, and it is why it reported
  // "seated eye is N, expected N" on 85 seats — 83 of them "sit at the slot",
  // every one off by an identical 0.345-0.350 m.
  //
  // An identical constant across 83 different seats is never 83 broken seats.
  // Traced frame by frame (scripts/probes/w96-seat-eye-settles.mjs), a slot
  // stool reads 1.369 against a wanted 1.395 on the FIRST frame — correct — and
  // then sinks to 1.050 over ~340 ms and stays. That descent is the world's
  // FOCUS pass (crosstown.ts:1234-1247) easing the camera onto the machine's
  // screen along its own face normal, which is the "integrated overlay" the user
  // asked for. A plain chair does not move at all: "sit down" and "sit at the
  // coupon table" hold their exact height for the full 1.2 s.
  //
  // So the question this leg asks — DID SITTING PUT YOUR EYE AT SEAT HEIGHT —
  // has to be asked at the moment of sitting. What a machine then does with the
  // camera is that machine's feature and has its own checks.
  //
  // IT IS NOT LOOSENED. The tolerance is still 0.04; the sample is taken over a
  // window and the BEST reading is used, so a seat that never once puts the eye
  // where its pan says still fails at every frame in that window. A fixed sleep
  // aimed at the first 50 ms would have been GOTCHAS 30 — right on this machine,
  // wrong under load — so it watches instead of guessing when to look.
  const sat = await pos();
  // You get THE seat you are standing on, not a neighbour.
  //
  // This used to allow a metre of slack, and I wrote the excuse myself: a
  // diner booth run is back to back, booth n's far bench and booth n+1's near
  // bench are 0.67 m apart, any trigger big enough to reach one from the aisle
  // overlaps the other, "and the E dispatch takes the first match — so one of
  // each adjacent pair can never be the one chosen." I concluded the only fix
  // was shrinking triggers until both were unreachable, and settled for
  // asserting you landed on A seat of the run rather than THE seat.
  //
  // That was a DISPATCH BUG dressed up as geometry. The entry point's comment
  // said "nearest live spot wins" and the loop broke on the first spot in
  // range, so the winner was whichever module built earlier. Fixed there; the
  // overlap is now harmless, because overlapping triggers are fine as long as
  // the nearest one answers. Three seats were affected — two diner booths and
  // the bus stop bench — and every one of them passed this check while
  // seating the player somewhere they had not chosen.
  //
  // 0.5 m: under the 0.67 m that separates adjacent booths, so landing on a
  // neighbour now fails instead of being explained away.
  const offBy = Math.hypot(sat[0] - s.pose.x, sat[2] - s.pose.z);
  if (offBy > 0.5) {
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
  const drift = Math.hypot(still[0] - sat[0], still[2] - sat[2]);
  if (drift > 0.001) {
    // SAY WHERE THEY WENT. This used to report the distance and nothing else,
    // and a bare "moved 523.44 m while seated" is unreadable: it cannot be told
    // apart from a 2 mm jitter except by size, and it named neither the
    // destination nor whether the player was still seated when it happened.
    //
    // That mattered. The same failure is on record upstream as "seats-walk is
    // FLAKY, not broken" — and a 523 m displacement is not flakiness, it is a
    // teleport, which nobody could see from the message. Three separate
    // attempts to reproduce it against the world came back clean (6/6 on the
    // seat itself, 58/58 over a faithful minimal loop, and a 1 s hold that
    // moves nothing), so what this has to capture is the state at the moment
    // it fires, because that is the only place the cause is still visible.
    const stillOn = await seatedOn();
    const where = await p.evaluate(([x, z]) => {
      const near = window.__ct.spots()
        .filter((sp) => sp.ok && Math.hypot(x - sp.x, z - sp.z) < sp.r)
        .map((sp) => sp.label);
      const rm = window.__ct.roomDims().find((r) => Math.abs(x - r.cx) < r.w / 2 + 2);
      return { room: rm ? rm.id : 'the street', live: near };
    }, [still[0], still[2]]);
    fail(`moved ${f2(drift)} m while seated — from ${f2(sat[0])},${f2(sat[2])}`
      + ` to ${f2(still[0])},${f2(still[2])} (${where.room}), still seated: ${!!stillOn}`
      + `, live [E] there: ${where.live.length ? where.live.join(' / ') : 'none'}`);
    continue;
  }

  // seated eye height, read off the camera the world actually renders with.
  // gy is the floor under the seat; the eye must land seat-pan + SIT_EYE above
  // it, and must be a clear drop from standing or you are not sitting, you are
  // hovering.
  const wantEye = sat[3] + s.pose.h + SIT_EYE;
  // the closest the eye ever came to seat height in the window captured at the
  // moment of sitting — see the note above `eyeTrace`
  let eye = eyeTrace[0] ?? await camY();
  for (const y of eyeTrace) if (Math.abs(y - wantEye) < Math.abs(eye - wantEye)) eye = y;
  if (Math.abs(eye - wantEye) > 0.04) {
    fail(`seated eye is ${f2(eye)} at its closest over ${eyeTrace.length} frames, `
      + `expected ${f2(wantEye)} (floor ${f2(sat[3])} + pan ${f2(s.pose.h)} + ${SIT_EYE})`); continue;
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

// ── BREAK THE FAILURES DOWN, SO THE TOTAL CANNOT BE MISQUOTED ───────────────
//
// This is the whole lesson of item 255. A bare "109 of 219 FAILURES" was read
// all week as a backlog of 109 broken seats; it was in fact ONE thing counted 83
// times. A total with no shape invites exactly that mistake, and no amount of
// telling people not to quote it works as well as printing the shape next to it.
if (bad.length) {
  const kind = (d) => d.startsWith('UNREACHABLE') ? 'unreachable — no standable point in the trigger'
    : /^no ".*" prompt.*got null/.test(d) ? 'no [E] prompt at all from the standable point'
    : /^no ".*" prompt/.test(d) ? 'another [E] spot answered instead of the seat'
    : d.startsWith('sat at') ? 'E seated you on a DIFFERENT seat'
    : d.startsWith('seated eye') ? 'seated eye height wrong at the moment of sitting'
    : d.startsWith('seated prompt') ? 'no "stand up" when seated — a MACHINE seat is in its own overlay here'
    : d.startsWith('moved') ? 'moved while seated'
    : d.startsWith('stood up at') ? 'stood up somewhere other than where you sat down from'
    : d.includes('STUCK') ? 'stood up stuck in the furniture'
    : d.startsWith('E did not seat') ? 'E did not seat you'
    : d.startsWith('E did not get') ? 'E did not get you up again'
    : d.startsWith('the PREVIOUS') ? 'cascade from an earlier seat that would not release'
    : 'other';
  const by = new Map();
  for (const [, , d] of bad) by.set(kind(d), (by.get(kind(d)) ?? 0) + 1);
  console.log(`\n${bad.length} failures, by kind — READ THIS, NOT THE TOTAL:`);
  for (const [k, n] of [...by].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${k}`);
  }
  console.log('\n  ⚠ A large count against ONE kind is one fault repeated, not that many broken seats.');
}

// ── A POPULATION FLOOR, so a run that judged almost nobody cannot read green ──
//
// Correcting the approach yaw removed ~100 false failures, and the danger of any
// such correction is that it goes too far and starts hiding real ones. Two
// guards, and they are cheap:
//
//   · every registered seat must produce a RESULT. A seat that is skipped is
//     not a seat that passed, and without this a `continue` added upstream
//     could silently shrink the population while the ratio still looked fine.
//   · the world must actually have its seats. 219 today; the floor is well
//     under that so ordinary growth does not trip it, but a run against a world
//     that built almost no furniture cannot come back green.
const SEAT_FLOOR = 150;
if (results.length !== seats.length) {
  console.log(`\nREFUSING TO REPORT: ${seats.length} seats registered but only `
    + `${results.length} were judged — ${seats.length - results.length} produced no verdict at all.`);
  await b.close(); process.exit(3);
}
if (seats.length < SEAT_FLOOR) {
  console.log(`\nREFUSING TO REPORT: only ${seats.length} seats in the world, floor is ${SEAT_FLOOR}. `
    + 'A near-empty world passing this check proves nothing.');
  await b.close(); process.exit(3);
}
if (errs.length) console.log('\npage errors:\n  ' + errs.slice(0, 5).join('\n  '));
await b.close();
process.exit(bad.length || errs.length ? 1 : 0);
