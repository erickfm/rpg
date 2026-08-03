// THE KNOB WITH A USER COMPLAINT AT BOTH ENDS — held at both ends at once.
//
// `pickSpot` has been swung twice by two opposite reports, and either one can
// be "fixed" by returning the other. So this check is deliberately not about
// the change that prompted it: it pins BOTH ends and the middle, and it is red
// if any of them moves.
//
//   END TWO  *"i dont want sit on bed and watch tv to be the main option if im
//            facing the door to leave"* (2026-08-02). Standing near the bed in
//            flat 301, aimed at the door, [E] must offer the DOOR — and not at
//            one lucky distance but ACROSS THE BAND the user walks through.
//            Goes red if the near tier gets its outright win back.
//
//   AIM      From the SAME positions, aimed at the bed, [E] must offer the BED.
//            Without this, END TWO is satisfiable by breaking the bed seat.
//
//   END ONE  *"i dont want to be so far from the bed and the option is still to
//            sit on the bed and watch tv"* (2026-08-01), in its two halves:
//            (a) beyond the bed's touch circle and not aimed at it, the bed is
//                NOT offered — the aim-free reach stays small;
//            (b) standing ON the door's own stand-point but facing the bed, the
//                DOOR is still offered. That is w9's repro (fa5c32e01), and it
//                goes red if anyone makes `looked` dominant outright.
//
// (a) AND (b) PULL IN OPPOSITE DIRECTIONS ON PURPOSE. (b) wants a spot you are
// standing on to be unbeatable; END TWO wants aim to beat mere proximity. The
// only shape that satisfies all of them is the one where "standing ON it" is
// judged against the player's own body — see fp.ts's tier comment — and this
// check exists to stop the next person collapsing that back into one rule.
//
// IT WALKS. The station is reached by holding W from the doorway into the room
// through real collision, and every heading by holding the arrow keys, which
// drive `rig.yaw` through the same line the mouse does (fp.ts:427-429). Warping
// is used ONLY to enter flat 301 and to reach station 3's stand-point, which is
// travel, not the subject — a check that warps onto its own subject and reads
// the prompt is how an instrument goes its whole life without testing what it
// is named for.
//
// Every wait ends on WORLD STATE (position, yaw, prompt), never on a wall-clock
// guess: `dt` is clamped at 0.05 s and a fixed sleep lies under load.
//
//   SHOT_URL=http://localhost:4188/ node scripts/w40-bed-vs-door.mjs
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = aim('http://localhost:4188/');

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 620 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.waitForTimeout(2000);
await reportWorld(p, URL);

const prompt = () => p.evaluate(() => {
  const el = document.getElementById('ct-prompt');
  const t = (el?.textContent ?? '').trim();
  return t ? t.replace(/^\s*\[E\]\s*/, '') : null;
});
const pos = () => p.evaluate(() => { const q = window.__ct.pos(); return { x: q[0], z: q[2] }; });
const yaw = () => p.evaluate(() => window.__ct.yaw());
const frames = (n = 2) => p.evaluate((k) => new Promise((r) => {
  let i = 0; const tick = () => (++i >= k ? r() : requestAnimationFrame(tick));
  requestAnimationFrame(tick);
}), n);

// HELD, not pressed. `press('e')` can begin and end inside one animation frame
// and the [E] dispatch is an edge read once per RENDERED frame, so the tap is
// never observed — three false failures came from exactly that.
const pressE = async () => {
  await p.keyboard.down('e'); await p.waitForTimeout(90); await p.keyboard.up('e');
  await p.waitForTimeout(350);
};

const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const bearing = (from, to) => Math.atan2(to.x - from.x, -(to.z - from.z));

/** Turn to `want` with the arrow keys — real look input, ended on real yaw. */
async function turnTo(want) {
  for (let i = 0; i < 120; i++) {
    const err = norm(want - (await yaw()));
    if (Math.abs(err) < 0.04) return true;
    const key = err > 0 ? 'ArrowRight' : 'ArrowLeft';
    await p.keyboard.down(key);
    await p.waitForTimeout(Math.min(260, Math.max(30, Math.abs(err) / 1.7 * 1000)));
    await p.keyboard.up(key);
    await frames(2);
  }
  return false;
}

/** Hold W until `done(pos)`, or until we stop making progress. Real collision. */
async function walkUntil(done, label) {
  let last = await pos(), stalled = 0;
  await p.keyboard.down('w');
  for (let i = 0; i < 140; i++) {
    await p.waitForTimeout(55);
    const now = await pos();
    if (done(now)) { await p.keyboard.up('w'); return { ok: true, at: now }; }
    if (Math.hypot(now.x - last.x, now.z - last.z) < 0.004) { if (++stalled > 12) break; } else stalled = 0;
    last = now;
  }
  await p.keyboard.up('w');
  return { ok: false, at: await pos(), note: `walk did not reach ${label}` };
}

const fails = [];
const say = (ok, line) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${line}`); if (!ok) fails.push(line); };

// ── the room, and the rule's own constants, asked of the world ────────────
const gy = await p.evaluate(() => window.__ct.groundAt(199.36, -15.545));
await p.evaluate(([gy]) => window.__ct.warp(199.36, -15.545, 0, gy, 0), [gy]);
await p.waitForTimeout(600);

// DERIVED, NOT RETYPED. RADIUS and TOUCH_MARGIN are what fp.ts's tiers are
// actually built on, so the thresholds this check asserts against are imported
// from it. A hand-typed 0.36 here would keep passing after someone changed the
// player's capsule, which is BUILDER-BRIEF §8's whole complaint.
// …AND IT IS READ OFF `__ct`, NOT IMPORTED (item 232). This did
// `await import('/src/proto/fp.ts')`, which resolves on the dev server and
// **404s on `vite preview`**: the bundle serves `dist/`, which has no such
// path. So the very hand-typing this comment objects to was being avoided in a
// way that produced `undefined` on the build that ships (GOTCHAS 28). Both
// values are published — `playerRadius()` at `crosstown.ts:1643`,
// `touchMargin()` at `:1629` — which is the runtime path the note wanted.
const K = await p.evaluate(() => ({
  RADIUS: window.__ct.playerRadius(), TOUCH_MARGIN: window.__ct.touchMargin(),
}));
if (![K.RADIUS, K.TOUCH_MARGIN].every((v) => typeof v === 'number' && isFinite(v))) {
  console.error(`ABORT: constants did not resolve off __ct — ${JSON.stringify(K)}`);
  await b.close(); process.exit(3);
}
console.log(`\nfp.ts: RADIUS=${K.RADIUS} TOUCH_MARGIN=${K.TOUCH_MARGIN}`);

const room = await p.evaluate(() => {
  const s = window.__ct.spots().filter((q) => q.ok && q.x > 190 && q.x < 210);
  const bed = s.find((q) => /bed/i.test(q.label));
  const door = s.find((q) => /the door/i.test(q.label));
  return { bed: bed && { x: bed.x, z: bed.z, r: bed.r, label: bed.label },
    door: door && { x: door.x, z: door.z, r: door.r, label: door.label } };
});
// CANNOT ANSWER is not the same news as WRONG. If the two subjects are not in
// this world the run measured nothing and must not score either way (GOTCHAS §32).
if (!room.bed || !room.door) {
  console.error('CANNOT ANSWER — flat 301 does not register both a bed seat and a door spot.');
  console.error(`  bed=${JSON.stringify(room.bed)} door=${JSON.stringify(room.door)}`);
  await b.close(); process.exit(3);
}
const { bed, door } = room;
console.log(`bed  "${bed.label}"  (${bed.x.toFixed(2)}, ${bed.z.toFixed(2)}) r${bed.r}`);
console.log(`door "${door.label}" (${door.x.toFixed(2)}, ${door.z.toFixed(2)}) r${door.r}`);
console.log(`separation ${Math.hypot(bed.x - door.x, bed.z - door.z).toFixed(2)} m`);
console.log(`the bed's aim-free touch circle reaches ${(bed.r + K.TOUCH_MARGIN).toFixed(2)} m\n`);

// ── STATION 1: THE WHOLE BAND, WALKED, IN BOTH DIRECTIONS ─────────────────
//
// Not one point. The bug was present across the entire overlap between the
// bed's touch circle and the door's — 10 of 19 standable cells
// (scripts/probes/w40-301-grid.mjs) — and one sample inside a band is a check
// that passes on the day and rots the week after.
//
// So the band is read the way the user meets it: standing by the bed, TURNED
// TOWARD THE DOOR, walking out — *"if im facing the door to leave"* is a walk,
// not a pose. The prompt is read every stride of the way out, and again every
// stride of the way back in facing the bed.
console.log('STATION 1 — in to the bed, then the band walked out facing the door');
await p.evaluate(([x, z, y, gy]) => window.__ct.warp(x, z, y, gy, 0),
  [door.x, door.z, bearing(door, bed), gy]);
await p.waitForTimeout(400);
const start = await pos();
const arrive = await walkUntil((q) => Math.hypot(q.x - bed.x, q.z - bed.z) < 0.30, 'the bed');
const walked = Math.hypot(arrive.at.x - start.x, arrive.at.z - start.z);
console.log(`  walked ${walked.toFixed(2)} m in, to ${Math.hypot(arrive.at.x - bed.x, arrive.at.z - bed.z).toFixed(2)} m from the bed`);
// THE WALK IS PART OF THE EVIDENCE. If it did not happen, every verdict below
// is about the doorway rather than about the bed — and would read as a pass.
say(walked > 0.6, `the walk in actually happened (${walked.toFixed(2)} m > 0.60)`);

// THE CONTESTED BAND, stated once and derived from fp.ts's own constants: you
// are inside the bed's aim-free touch circle, so proximity has an opinion, but
// you are standing ON neither spot, so aim is a meaningful question and must be
// the one that decides. Above the band nothing is touching; below it, or inside
// the door's own capsule, you are standing IN something and END ONE(b) governs.
const REACH = bed.r + K.TOUCH_MARGIN;
const inBand = (dBed, dDoor) => dBed >= K.RADIUS && dBed <= REACH && dDoor >= K.RADIUS;

/** Walk a stride at a time, reading the prompt at each while facing `face`.
 *  Returns every sample taken inside the contested band. */
async function bandWalk(face, key, until) {
  const seen = [];
  for (let i = 0; i < 60; i++) {
    const at = await pos();
    const dBed = Math.hypot(at.x - bed.x, at.z - bed.z);
    const dDoor = Math.hypot(at.x - door.x, at.z - door.z);
    // Re-aim every stride: walking changes the bearing to the target, and a
    // heading set once at the start would drift off it within a metre.
    await turnTo(bearing(at, face));
    const got = await prompt();
    if (inBand(dBed, dDoor)) seen.push({ dBed, dDoor, got, at });
    if (until(at, dBed)) break;
    // SHORT strides. At 150 ms the player covered 0.55 m a step and crossed the
    // whole band in two samples, which is not a band, it is two points.
    await p.keyboard.down(key); await p.waitForTimeout(30); await p.keyboard.up(key);
    await frames(2);
  }
  return seen;
}

// OUT, facing the door — the user's own sentence
const outward = await bandWalk(door, 'w', (_, dBed) => dBed > REACH + 0.15);
for (const s of outward) console.log(`    ${s.dBed.toFixed(2)} m from the bed, facing the door -> [E] ${s.got ?? '(none)'}`);
const badOut = outward.filter((s) => !/door/i.test(s.got ?? ''));
say(outward.length >= 2, `the band was sampled on the way out (${outward.length} strides inside ${K.RADIUS}-${REACH.toFixed(2)} m of the bed)`);
say(badOut.length === 0,
  `END TWO: walking out facing the door, the DOOR is offered at every stride`
  + (badOut.length ? ` — ${badOut.length} offered "${badOut[0].got}" at ${badOut[0].dBed.toFixed(2)} m` : ''));

// BACK IN, facing the bed — the same band, the other heading
const inward = await bandWalk(bed, 'w', (_, dBed) => dBed < K.RADIUS + 0.05);
for (const s of inward) console.log(`    ${s.dBed.toFixed(2)} m from the bed, facing the bed  -> [E] ${s.got ?? '(none)'}`);
const badIn = inward.filter((s) => !/bed/i.test(s.got ?? ''));
say(inward.length >= 2, `and on the way back in (${inward.length} strides)`);
say(badIn.length === 0,
  'AIM: walking the SAME band facing the bed, the BED is offered at every stride'
  + (badIn.length ? ` — ${badIn.length} offered "${badIn[0].got}" at ${badIn[0].dBed.toFixed(2)} m` : ''));

// BOTH MUST FIRE, not merely be named — and from a spot in the band, not from
// on top of the bed, or the door is not the thing being offered in the first place.
console.log('  — and both offers must actually fire —');
await walkUntil((q) => Math.hypot(q.x - bed.x, q.z - bed.z) > 0.55, 'the middle of the band');
const fireAt = await pos();
console.log(`    firing from ${Math.hypot(fireAt.x - bed.x, fireAt.z - bed.z).toFixed(2)} m from the bed`);
await turnTo(bearing(fireAt, door));
const b0 = await prompt();
await pressE();
const b1 = await prompt();
say(/door/i.test(b0 ?? '') && /door/i.test(b1 ?? '') && b0 !== b1,
  `the offered door actually acted (${b0} -> ${b1})`);
await pressE();                                       // put the door back
await turnTo(bearing(fireAt, bed));
const s0 = await prompt();
await pressE();
const seated = await prompt();
say(/bed/i.test(s0 ?? '') && /stop watching|stand/i.test(seated ?? ''),
  `the offered bed seat actually seated you (${s0} -> ${seated})`);
await p.keyboard.down('Escape'); await p.waitForTimeout(90); await p.keyboard.up('Escape');
await p.waitForTimeout(400);

// ── STATION 2: END ONE (a) — beyond the bed, not aimed at it ──────────────
console.log('\nSTATION 2 — walked back out, beyond the bed\'s reach, not aimed at it');
await turnTo(bearing(await pos(), door));
const out = await walkUntil((q) => Math.hypot(q.x - bed.x, q.z - bed.z) > bed.r + K.TOUCH_MARGIN + 0.35, 'clear of the bed');
const dOut = Math.hypot(out.at.x - bed.x, out.at.z - bed.z);
console.log(`  standing ${dOut.toFixed(2)} m from the bed (its touch circle reaches ${(bed.r + K.TOUCH_MARGIN).toFixed(2)} m)`);
// A CHECK PROVING AN ABSENCE MUST PROVE IT LOOKED AT SOMETHING (GOTCHAS 71):
// the distance is asserted FIRST, so "the bed was not offered" cannot be
// satisfied by never having left the doorway, or by the spot not existing.
say(dOut > bed.r + K.TOUCH_MARGIN, `and it really is beyond the bed's aim-free reach (${dOut.toFixed(2)} > ${(bed.r + K.TOUCH_MARGIN).toFixed(2)})`);
const away = await prompt();
console.log(`  facing away from the bed -> [E] ${away ?? '(none)'}`);
say(!/bed/i.test(away ?? ''), 'END ONE(a): far from the bed and not aimed at it, the bed is NOT offered');

// ── STATION 3: END ONE (b) — w9's repro, standing IN the door ─────────────
console.log('\nSTATION 3 — standing ON the door\'s own stand-point, facing the bed');
await p.evaluate(([x, z, y, gy]) => window.__ct.warp(x, z, y, gy, 0), [door.x, door.z, bearing(door, bed), gy]);
await p.waitForTimeout(500);
const onDoor = await pos();
const dToDoor = Math.hypot(onDoor.x - door.x, onDoor.z - door.z);
// NOT `< 0.05`. The rig's unstick nudges you off the exact point — measured at
// 0.06 m here — and a tolerance tighter than that would fail on the collision
// system rather than on the thing under test. What matters is that the spot's
// centre is inside the player's own capsule, which is the rule tier 1 uses.
console.log(`  standing ${dToDoor.toFixed(3)} m from the stand-point (own capsule ${K.RADIUS} m)`);
say(dToDoor < K.RADIUS, `the stand-point is inside the player's own capsule, so this really is "standing in it"`);
say(await turnTo(bearing(onDoor, bed)), 'turned to face the bed with the arrow keys');
const inDoor = await prompt();
console.log(`  -> [E] ${inDoor ?? '(none)'}`);
say(/door/i.test(inDoor ?? ''),
  'END ONE(b): a door you are STANDING IN still beats the bed you are aimed at');

console.log('');
if (fails.length) {
  console.log(`MEASURED WRONG — ${fails.length} of the pinned behaviours moved:`);
  for (const f of fails) console.log(`   · ${f}`);
  await b.close(); process.exit(1);
}
console.log('MEASURED FINE — both ends of the knob hold, and the band between them does too.');
await b.close(); process.exit(0);
