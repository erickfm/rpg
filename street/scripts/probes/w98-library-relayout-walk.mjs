// CAN YOU ACTUALLY WALK THE RELAID LIBRARY? Item 115.
//
// The user: *"library is crowded in some areas and spacious in others. try a
// different layout thanks."* The relayout (int-library.ts, 2026-08-03) does two
// things to COLLISION, which is the one class of change this project refuses to
// accept a screenshot for:
//
//   · a 1.70 m CROSS AISLE cut through the five stack runs at mid-depth, so the
//     block has a route through it instead of only round the ends;
//   · the ISSUE DESK moved from the middle of the reading floor back to the
//     entrance end (its 5.8 m setback was clearance for the vestibule, deleted
//     2026-07-25), which puts a 3.3 x 2.75 m collider beside the way in.
//
// So this drives the player. Every route is WALKED with a held key, never
// warped along and measured.
//
// ── WHAT THIS PROBE WAS WRITTEN AROUND ──────────────────────────────────────
//
// POPULATION FLOOR, PER REGION. A walk that finds no stacks passes vacuously
// (GOTCHAS 34), so the stack banks are COUNTED and the cross aisle's width is
// MEASURED off the colliders before anything is walked. Zero banks, or a gap
// that is not the one the source builds, aborts with 3 rather than passing.
//
// A NEGATIVE CASE ON THE SAME MECHANISM. `cross` walks east along the cross
// aisle and must arrive; `blocked` walks east along the CENTRE OF A BANK from
// the same x and must be stopped by the shelving. Without the second, the first
// proves only that the player can move — it would pass just as green on a world
// with no colliders at all, which is exactly how this suite has been fooled
// before. Both signs, every run.
//
// NOTHING IS HAND-TYPED. The banks, the aisle centres and the desk's faces are
// all read out of `__ct.colliders()` and `__ct.roomDims()`, so moving any of
// them moves the check with them. Every hand-typed coordinate on this project
// has been wrong once (GOTCHAS 20).
//
// FIVE RUNS, and the spread is printed. A single green run says nothing about a
// walk whose frame budget varies with load (GOTCHAS 30).
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4540/');
const RUNS = Number(process.env.RUNS || 5);
const PASSABLE = 0.95;                 // ct/gap.ts:25, copied with its citation

// Camera convention: the rig looks along (sin yaw, -cos yaw) — GOTCHAS 33.
//
// AND THE LIBRARY'S ENTRANCE IS AT +z, WHICH IS THE TRAP IN THIS FILE. The door
// is in the z = +D/2 wall and the stacks are at -z, so "walk into the room" is
// yaw 0 and "walk back out at the doors" is PI. Named for the ROOM rather than
// for a compass, because the first cut of this probe called PI "SOUTH", used it
// to enter, and walked the player into the front wall at z 10.82 on all five
// runs — a confident 0/5 FAIL against a room that was fine. The `aisle` walk in
// the same run had already proved yaw 0 decreases z; the constant disagreed
// with the evidence sitting next to it.
const EAST = Math.PI / 2;
const INTO = 0;                        // toward the stacks, away from the doors
void Math.PI;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct && window.__ct.roomDims, null, { timeout: 60000 });
await waitPainted(p, { quiet: true });

const pos = () => p.evaluate(() => window.__ct.pos());

// ── the room, and the furniture in it, in LOCAL coords ──────────────────────
const room = await p.evaluate(() => {
  const dims = window.__ct.roomDims();
  if (!Array.isArray(dims)) throw new Error('roomDims() is an ARRAY — dims.library sweeps the world');
  const r = dims.find((d) => /library/i.test(d.id));
  if (!r) throw new Error(`no library; ids: ${dims.map((d) => d.id).join(',')}`);
  return r;
});
const L = (lx, lz) => [room.cx + lx, room.cz + lz];        // local -> world

const boxes = await p.evaluate(([cx, cz, w, d]) => {
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
  return window.__ct.colliders()
    .filter((c) => c.maxX > x0 && c.minX < x1 && c.maxZ > z0 && c.minZ < z1)
    .map((c) => ({
      x0: +(c.minX - cx).toFixed(3), x1: +(c.maxX - cx).toFixed(3),
      z0: +(c.minZ - cz).toFixed(3), z1: +(c.maxZ - cz).toFixed(3),
    }));
}, [room.cx, room.cz, room.w, room.d]);

// ── POPULATION: the stack banks, discovered not assumed ─────────────────────
// A stack run is 0.60 m deep across x and stands in the back half. Grouped by
// their x centre so the two banks of one run are recognised as one run.
// ...AND NOT THE SHELVING ON THE GALLERY WALL. The first cut of this filter
// took anything 0.6 m across standing in the back half, which also describes the
// two wall runs under the gallery deck at x 9.68. They came back as a sixth
// "stack run", which put the eastward target at x 10.68 — OUTSIDE a room whose
// half-width is 10 — so the cross-aisle walk could never arrive and reported
// 0/5 against a traverse that had in fact crossed every run. A free-standing bay
// is one you walk BOTH sides of; a wall run is against a wall. Derived from the
// room's own width rather than from the gallery's x.
const freeStanding = (c) => Math.abs((c.x0 + c.x1) / 2) < room.w / 2 - 1.0;
const runs = boxes.filter((c) => (c.x1 - c.x0) < 0.8 && (c.z1 - c.z0) > 1.5
  && c.z1 < 0 && freeStanding(c));
const byX = new Map();
for (const r of runs) {
  const k = ((r.x0 + r.x1) / 2).toFixed(2);
  if (!byX.has(k)) byX.set(k, []);
  byX.get(k).push(r);
}
const abort = (m) => { console.log(`ABORT  ${m}`); return b.close().then(() => process.exit(3)); };
if (byX.size === 0) await abort('no stack runs found in the library — measuring nothing');
const split = [...byX.values()].filter((v) => v.length === 2);
if (split.length === 0) await abort('no run is split into two banks — the cross aisle does not exist');

// the cross aisle, measured off the banks themselves
const gaps = split.map((v) => {
  const [a, c] = v.sort((m, n) => m.z0 - n.z0);
  return +(c.z0 - a.z1).toFixed(3);
});
const CROSS_W = gaps[0];
const CROSS_Z = (() => {
  const [a, c] = split[0].sort((m, n) => m.z0 - n.z0);
  return (a.z1 + c.z0) / 2;
})();
const runXs = [...byX.keys()].map(Number).sort((a, c) => a - c);
const runHalf = (runs[0].x1 - runs[0].x0) / 2;

console.log(`library ${room.w} x ${room.d} m at (${room.cx}, ${room.cz})`);
console.log(`stack runs: ${byX.size}  (${split.length} split into two banks)`);
console.log(`run x centres: ${runXs.join(', ')}`);
console.log(`cross aisle: ${CROSS_W.toFixed(2)} m wide, centred z ${CROSS_Z.toFixed(2)}  `
  + `(all gaps: ${[...new Set(gaps)].join(', ')})`);
if (!(CROSS_W > PASSABLE)) await abort(`cross aisle ${CROSS_W} m is not passable (${PASSABLE})`);

// the longitudinal aisles, also measured
const aisles = [];
for (let i = 1; i < runXs.length; i++) {
  aisles.push(+((runXs[i] - runHalf) - (runXs[i - 1] + runHalf)).toFixed(3));
}
console.log(`longitudinal aisles: ${[...new Set(aisles)].join(', ')} m`);

// the issue desk — the biggest collider in the entrance half
const desk = boxes.filter((c) => c.z0 > 2)
  .sort((a, c) => ((c.x1 - c.x0) * (c.z1 - c.z0)) - ((a.x1 - a.x0) * (a.z1 - a.z0)))[0];
console.log(`issue desk: x ${desk.x0}..${desk.x1}  z ${desk.z0}..${desk.z1}`);

// ── the walker ──────────────────────────────────────────────────────────────
// Walk until you ARRIVE or stop making progress — never for a fixed time.
// GOTCHAS 30: a frame is 17 ms idle and over a second under load.
const walk = async (key, done, capMs = 12000) => {
  const t0 = Date.now();
  let last = await pos(), still = 0;
  await p.keyboard.down(key);
  try {
    while (Date.now() - t0 < capMs) {
      await p.waitForTimeout(200);
      if (await done()) break;                      // awaited — GOTCHAS 90
      const now = await pos();
      const moved = Math.hypot(now[0] - last[0], now[2] - last[2]);
      still = moved < 0.02 ? still + 1 : 0;
      last = now;
      if (still >= 3) break;                        // wedged, not slow
    }
  } finally {
    await p.keyboard.up(key);
    await p.waitForTimeout(150);
  }
  return pos();
};
const start = async (lx, lz, yaw) => {
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0), [...L(lx, lz), yaw]);
  await p.waitForTimeout(260);
};
const lx = (wx) => wx - room.cx;
const lz = (wz) => wz - room.cz;

// ── the four walks, one run ─────────────────────────────────────────────────
const WEST_START = runXs[0] - runHalf - 0.9;        // in the west return aisle
const EAST_TARGET = runXs[runXs.length - 1] + runHalf + 0.7;
const BANK_Z = (() => { const [a] = split[0].sort((m, n) => m.z0 - n.z0); return (a.z0 + a.z1) / 2; })();

const once = async () => {
  const r = {};

  // 1. CROSS AISLE — west end to east end, through every run. The new route.
  await start(WEST_START, CROSS_Z, EAST);
  let e = await walk('w', async () => lx((await pos())[0]) > EAST_TARGET);
  r.cross = +lx(e[0]).toFixed(2);
  r.crossOk = r.cross > EAST_TARGET;

  // 2. NEGATIVE — the same eastward walk down the CENTRE OF A BANK must be
  //    stopped by the shelving. Without this the run above proves only that the
  //    player can move at all.
  await start(WEST_START, BANK_Z, EAST);
  e = await walk('w', async () => lx((await pos())[0]) > EAST_TARGET, 6000);
  r.blocked = +lx(e[0]).toFixed(2);
  r.blockedOk = r.blocked < runXs[0];               // never reached the first run's far side

  // 3. LONGITUDINAL — up an aisle from the hall end to the back wall, straight
  //    through the cross aisle. The cross must not have broken the runs' own use.
  const aisleX = (runXs[0] + runXs[1]) / 2;
  await start(aisleX, -1.4, INTO);
  e = await walk('w', async () => lz((await pos())[2]) < -9.0);
  r.aisle = +lz(e[2]).toFixed(2);
  r.aisleOk = r.aisle < -9.0;

  // 4. ENTRY — in at the doors on the door axis and down to the reading hall,
  //    past the desk that has just moved to the entrance.
  await start(0, room.d / 2 - 0.9, INTO);
  e = await walk('w', async () => lz((await pos())[2]) < 0);
  r.entry = +lz(e[2]).toFixed(2);
  r.entryOk = r.entry < 0;

  // 5. TO THE COUNTER — walk to the desk to be served, and stop AT it.
  const deskCX = (desk.x0 + desk.x1) / 2;
  await start(deskCX, room.d / 2 - 0.9, INTO);
  e = await walk('w', async () => lz((await pos())[2]) < desk.z1 + 0.05, 8000);
  r.counter = +lz(e[2]).toFixed(2);
  r.counterOk = r.counter > desk.z1 && r.counter < desk.z1 + 1.2;   // stopped ON it, not through it
  return r;
};

// ── seats: the room must not have lost any, and none may be inside a box ────
const seats = await p.evaluate(([cx, cz]) => window.__ct.seats()
  .map((s) => s.pose)                              // coords live on .pose — GOTCHAS via w94
  .filter((q) => q && Math.abs(q.x - cx) < 11 && Math.abs(q.z - cz) < 12)
  .map((q) => ({ x: +(q.x - cx).toFixed(2), z: +(q.z - cz).toFixed(2) })), [room.cx, room.cz]);
const buried = seats.filter((s) => boxes.some((c) =>
  s.x > c.x0 && s.x < c.x1 && s.z > c.z0 && s.z < c.z1));
console.log(`seats: ${seats.length} registered, ${buried.length} inside a collider`);
if (seats.length === 0) console.log('  (none — SUSPICIOUS, this room makes three ctx.seat calls)');

// ── --selftest: SEAL THE CROSS AISLE AND WATCH THE VERDICT GO RED ───────────
//
// A check nobody has seen fail is a check they will argue with (GOTCHAS 27), and
// this suite has a documented family of guards that "slept". So: plant a box
// across the cross aisle between the first two runs and re-walk it. `cross` must
// turn FAIL. If it stays green the check is measuring nothing and the ALL GREEN
// above is worthless.
//
// The box goes on `__ct.colliders()`, which is LIVE BY REFERENCE — GOTCHAS 74
// says the same push onto `staticColliders()` lands in a copy nobody reads and
// the selftest then reports CAUGHT while testing nothing.
if (process.argv.includes('--selftest')) {
  const [a, c] = split[0].sort((m, n) => m.z0 - n.z0);
  await p.evaluate(([cx, cz, x0, x1, z0, z1]) => {
    window.__ct.colliders().push({
      minX: cx + x0, maxX: cx + x1, minZ: cz + z0, maxZ: cz + z1, minY: 0, maxY: 2,
    });
  }, [room.cx, room.cz, runXs[0] - runHalf, runXs[1] - runHalf, a.z1, c.z0]);
  const r = await once();
  const caught = !r.crossOk;
  console.log(`\nSELFTEST  cross aisle sealed between x ${(runXs[0] - runHalf).toFixed(2)} `
    + `and ${(runXs[1] - runHalf).toFixed(2)}, z ${a.z1.toFixed(2)}..${c.z0.toFixed(2)}`);
  console.log(`SELFTEST  cross walk came to rest at x ${r.cross} (needs > ${EAST_TARGET.toFixed(2)} to pass)`);
  console.log(`SELFTEST  ${caught ? 'CAUGHT — the verdict can fail' : 'SLEPT — THE CHECK IS MEASURING NOTHING'}`);
  await b.close();
  process.exit(caught ? 0 : 1);
}

// ── run it five times ───────────────────────────────────────────────────────
const rows = [];
for (let i = 0; i < RUNS; i++) rows.push(await once());

const keys = ['cross', 'blocked', 'aisle', 'entry', 'counter'];
console.log(`\n${RUNS} runs — the value each walk came to rest at (local m)`);
for (const k of keys) {
  const v = rows.map((r) => r[k]);
  const ok = rows.filter((r) => r[`${k}Ok`]).length;
  const lo = Math.min(...v), hi = Math.max(...v);
  console.log(`  ${k.padEnd(8)} ${String(ok).padStart(2)}/${RUNS} pass   `
    + `spread ${(hi - lo).toFixed(2)} m   [${v.join(', ')}]`);
}

const verdict = (n, ok, d) => console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${d}`);
console.log('');
let bad = 0;
const all = (k) => rows.every((r) => r[`${k}Ok`]);
for (const [k, d] of [
  ['cross', `cross aisle walked west->east past all ${runXs.length} runs`],
  ['blocked', 'and walking into a BANK is stopped by the shelving (negative case)'],
  ['aisle', 'a longitudinal aisle still runs hall-end to back wall'],
  ['entry', 'in at the doors and down to the reading hall'],
  ['counter', 'you reach the counter and stop at it, not through it'],
]) { if (!all(k)) bad++; verdict(k, all(k), d); }
verdict('seats', seats.length === 10 && buried.length === 0,
  `${seats.length} seats (expected 10), ${buried.length} buried`);
if (!(seats.length === 10 && buried.length === 0)) bad++;
verdict('aisles', aisles.every((a) => a > PASSABLE) && CROSS_W > PASSABLE,
  `every aisle > ${PASSABLE} m PASSABLE`);
if (!(aisles.every((a) => a > PASSABLE) && CROSS_W > PASSABLE)) bad++;

if (errs.length) console.log(`\npage errors: ${errs.length}\n${errs.slice(0, 3).join('\n')}`);
console.log(`\n${bad === 0 ? 'ALL GREEN' : `${bad} FAILED`}`);
await b.close();
process.exit(bad === 0 && errs.length === 0 ? 0 : 1);
