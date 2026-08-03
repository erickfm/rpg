// ITEM 291's ACCEPTANCE TEST, WALKED. *"just make the door high rank pls."*
//
// Two questions, and they pull against each other — that is the whole item:
//
//   (1) FACE THE DOOR FROM THREE DISTANCES  ->  you get the door
//   (2) STAND AT THE CALENDAR AND FACE IT   ->  you get the calendar
//
// WALKED, NOT WARPED, and that is not ceremony. The failure this item is about
// only exists along a route: the calendar's stand-point used to sit 0.036 m off
// the straight line from the bed to the door, so you met it by WALKING through
// it and never by standing anywhere in particular. A warp samples poses; it
// cannot sample a route. (The one warp below is the ENTRY into 301 — there is no
// way to walk into the flat from the street inside a test's patience.)
//
// Five runs, because a single green run of anything driven by the render loop is
// a coin that came up heads (GOTCHAS 30). Pass = 5/5.
//
//   SHOT_URL=http://localhost:4189/ node scripts/probes/w121-door-vs-calendar-walk.mjs [runs]
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const RUNS = Number(process.argv[2] ?? 5);
const URL = aim('http://localhost:4189/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 620 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.waitForTimeout(1500);
await reportWorld(p, URL);

// GOTCHAS 32 — a missing hook is "never ran", not "world is fine".
const hooks = await p.evaluate(() => ({
  spots: typeof window.__ct.spots, warp: typeof window.__ct.warp, pos: typeof window.__ct.pos,
}));
if (Object.values(hooks).some((t) => t !== 'function')) {
  console.error(`ABORT: __ct hooks missing — ${JSON.stringify(hooks)}`);
  await b.close(); process.exit(3);
}

const pos = () => p.evaluate(() => { const q = window.__ct.pos(); return { x: q[0], z: q[2] }; });
const yaw = () => p.evaluate(() => window.__ct.yaw());
const frames = (n = 2) => p.evaluate((k) => new Promise((r) => {
  let i = 0; const tick = () => (++i >= k ? r() : requestAnimationFrame(tick));
  requestAnimationFrame(tick);
}), n);
const prompt = () => p.evaluate(() => {
  const el = document.getElementById('ct-prompt');
  const t = (el?.textContent ?? '').trim();
  return t ? t.replace(/^\s*\[E\]\s*/, '').split('   ·   ')[0] : null;
});
const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const bearing = (from, to) => Math.atan2(to.x - from.x, -(to.z - from.z));

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
/** Hold W until `done`, or until progress stops. Real collision, real strides.
 *
 *  POLLED AT 30 ms, NOT 55, AND CAPPED AT 120 STEPS. At walking pace a 55 ms
 *  sample moves the player ~0.09 m, so a stop condition of "within 0.50 m of the
 *  door" can be stepped straight over — measured: the walk then ran its full 8.8
 *  s budget, slid along the south wall, out through the open doorway and stopped
 *  at (201.82, -19.61), 3.26 m away and out on the landing. It still read
 *  `close the door` there, off the door's HALL-side stand-point, so it scored
 *  green for a pose it never meant to sample. A stride longer than the feature
 *  is GOTCHAS 48 wearing walking boots. */
async function walkUntil(done) {
  let last = await pos(), stalled = 0;
  await p.keyboard.down('w');
  for (let i = 0; i < 120; i++) {
    await p.waitForTimeout(30);
    const now = await pos();
    if (done(now)) { await p.keyboard.up('w'); return { ok: true, at: now }; }
    if (Math.hypot(now.x - last.x, now.z - last.z) < 0.004) { if (++stalled > 12) break; } else stalled = 0;
    last = now;
  }
  await p.keyboard.up('w');
  return { ok: false, at: await pos() };
}
const dist = (a, c) => Math.hypot(a.x - c.x, a.z - c.z);

const room = await p.evaluate(() => {
  const gy = window.__ct.groundAt(199.36, -15.545);
  window.__ct.warp(199.36, -15.545, 0, gy, 0);
  return gy;
});
await p.waitForTimeout(600);
const spots = await p.evaluate(() => {
  const s = window.__ct.spots().filter((q) => q.ok && q.x > 190 && q.x < 210);
  const g = (re) => { const h = s.find((q) => re.test(q.label)); return h && { x: h.x, z: h.z, r: h.r, rank: h.rank, label: h.label }; };
  return { bed: g(/bed/i), door: g(/the door/i), cal: g(/calendar/i) };
});
if (!spots.door || !spots.cal || !spots.bed) {
  console.error(`CANNOT ANSWER — 301 does not register all three: ${JSON.stringify(spots)}`);
  await b.close(); process.exit(3);
}
console.log(`door "${spots.door.label}" (${spots.door.x.toFixed(2)}, ${spots.door.z.toFixed(2)}) r${spots.door.r} rank ${spots.door.rank}`);
console.log(`cal  "${spots.cal.label}" (${spots.cal.x.toFixed(2)}, ${spots.cal.z.toFixed(2)}) r${spots.cal.r} rank ${spots.cal.rank}`);
console.log(`bed  "${spots.bed.label}" (${spots.bed.x.toFixed(2)}, ${spots.bed.z.toFixed(2)}) r${spots.bed.r} rank ${spots.bed.rank}`);
console.log(`cal -> door ${dist(spots.cal, spots.door).toFixed(3)} m   cal -> bed ${dist(spots.cal, spots.bed).toFixed(3)} m\n`);

const results = [];
for (let run = 1; run <= RUNS; run++) {
  const legs = [];
  // ── (1) FACE THE DOOR FROM THREE DISTANCES, ON TWO DIFFERENT ROUTES ───────
  //
  // ⚠ THE STAND-OFFS ARE CHOSEN TO CLEAR THE BED'S OWN `onIt` BALL, and that is
  // a correction to my own first draft rather than a concession. 301 is 1.27 m
  // from the bed seat to the door stand-point, so "1.2 m from the door" is
  // 0.07 m from the BED — you are standing IN the bed, where the user's own
  // guard rail says the bed must win however you are facing. Measured: that
  // draft read `[E] sit on the bed and watch TV` 5 runs out of 5, and it was
  // right to. A test that walks the player into one spot and then complains he
  // was not offered a different one is testing nothing.
  //
  // ROUTE A — from the north end of the room, past the chair, the way you cross
  // 301 to leave. Nothing else's ball is on it.
  for (const want of [1.50, 1.05, 0.70]) {
    await p.evaluate(([x, z, y, gy]) => window.__ct.warp(x, z, y, gy, 0),
      [spots.door.x - 0.10, spots.door.z + 2.30, 0, room]);
    await p.waitForTimeout(300);
    await turnTo(bearing(await pos(), spots.door));
    await walkUntil((q) => dist(q, spots.door) <= want);
    await turnTo(bearing(await pos(), spots.door));
    await p.waitForTimeout(200);
    const at = await pos(), got = await prompt();
    legs.push({ leg: `A door @ ${dist(at, spots.door).toFixed(2)} m (bed ${dist(at, spots.bed).toFixed(2)} m) `
      + `at (${at.x.toFixed(2)}, ${at.z.toFixed(2)})`, got, ok: /door/i.test(got ?? '') });
  }
  // ROUTE B — the user's own sentence, *"if im facing the door to leave"*: off
  // the bed and straight out. Stand-offs stop 0.42 m short of the bed seat, the
  // nearest a player can be without standing in it.
  for (const want of [0.85, 0.62, 0.40]) {
    await p.evaluate(([x, z, y, gy]) => window.__ct.warp(x, z, y, gy, 0),
      [spots.bed.x, spots.bed.z, 0, room]);
    await p.waitForTimeout(300);
    await turnTo(bearing(await pos(), spots.door));
    await walkUntil((q) => dist(q, spots.door) <= want);
    await turnTo(bearing(await pos(), spots.door));
    await p.waitForTimeout(200);
    const at = await pos(), got = await prompt();
    legs.push({ leg: `B door @ ${dist(at, spots.door).toFixed(2)} m (bed ${dist(at, spots.bed).toFixed(2)} m)`,
      got, ok: /door/i.test(got ?? '') });
  }
  // ── (2) STAND AT THE CALENDAR AND FACE IT ─────────────────────────────────
  // Walk to the calendar's own stand-point and look at the calendar.
  await p.evaluate(([x, z, y, gy]) => window.__ct.warp(x, z, y, gy, 0),
    [spots.bed.x, spots.bed.z, 0, room]);
  await p.waitForTimeout(350);
  await turnTo(bearing(await pos(), spots.cal));
  await walkUntil((q) => dist(q, spots.cal) <= 0.20);
  // face the calendar ITSELF on the south wall, not its stand-point
  await turnTo(bearing(await pos(), { x: spots.cal.x, z: spots.cal.z - 1.0 }));
  await p.waitForTimeout(200);
  const catAt = await pos(), calGot = await prompt();
  legs.push({ leg: `calendar @ ${dist(catAt, spots.cal).toFixed(2)} m from its stand-point`,
    got: calGot, ok: /calendar/i.test(calGot ?? '') });

  const bad = legs.filter((l) => !l.ok);
  results.push(bad.length === 0);
  console.log(`run ${run}: ${bad.length === 0 ? 'PASS' : 'FAIL'}`);
  for (const l of legs) console.log(`    ${l.ok ? 'ok  ' : 'FAIL'}  ${l.leg} -> [E] ${l.got ?? '(none)'}`);
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${RUNS} runs green`);
await b.close();
process.exit(passed === RUNS ? 0 : 1);
