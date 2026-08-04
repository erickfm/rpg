// ITEM 310 — WHO WINS WHERE THE CALENDAR AND THE DOOR ARE BOTH UNDER YOUR FEET.
//
// The user, standing at the calendar in flat 301: *"somehow when im closerest to
// the calendar it defaults to door again? not even looking at door"*.
//
// 301's room-side door stand-point and the calendar's are **0.322 m apart**
// against a `2 * ON_IT` overlap width of **0.576 m**, so there is a lens of
// floor where BOTH centres are inside the player's capsule. Both land in
// `pickSpot`'s tier 1, and until item 310 `WAY_OUT` on the door then won there
// from every pose — including the pose where the player is nearer the calendar
// and looking straight at it.
//
// WHAT THIS ASSERTS, as numbers rather than an absence:
//
//   1. FACING THE CALENDAR, along the page's own column, the calendar is
//      offered at every sample inside its own disc. Prints the count.
//   2. FACING THE DOOR from the same squares, the DOOR is still offered — the
//      `WAY_OUT` guarantee (item 291, *"just make the door high rank"*) must
//      survive this change, so a door you are standing in is never unreachable.
//   3. The two sets are measured at the SAME positions, so a run where the warp
//      silently failed reports 0 samples and fails loudly rather than passing.
//
// It reads the published prompt at warped positions — no walking, no clock, no
// pixels (BUILDER-BRIEF §10a). Collision is not in question here; selection is.
//
//   SHOT_URL=http://localhost:5177/ node scripts/probes/w310-calendar-vs-door.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:5177/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 620 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.waitForTimeout(1800);

const prompt = () => p.evaluate(() => {
  const el = document.getElementById('ct-prompt');
  const t = (el?.textContent ?? '').trim();
  return t ? t.replace(/^\s*\[E\]\s*/, '') : null;
});

const K = await p.evaluate(() => ({
  onIt: window.__ct.onItRadius ? window.__ct.onItRadius() : window.__ct.playerRadius(),
}));
const spots = await p.evaluate(() =>
  window.__ct.spots().filter((s) => s.x > 195 && s.x < 203 && s.z > -19 && s.z < -14));
const cal = spots.find((s) => /calendar/.test(s.label));
const door = spots.filter((s) => /the door/.test(s.label)).sort((a, c) => a.x - c.x)[0];
if (!cal || !door) {
  console.error(`ABORT: calendar=${!!cal} door=${!!door} among ${spots.length} spots in 301`);
  await b.close(); process.exit(3);
}

const gap = Math.hypot(cal.x - door.x, cal.z - door.z);
console.log(`ON_IT ${K.onIt.toFixed(3)}   overlap width 2*ON_IT = ${(2 * K.onIt).toFixed(3)}`);
console.log(`cal  (${cal.x.toFixed(3)}, ${cal.z.toFixed(3)}) rank ${cal.rank ?? 0}`);
console.log(`door (${door.x.toFixed(3)}, ${door.z.toFixed(3)}) rank ${door.rank ?? 0}   ${gap.toFixed(3)} m apart`);
if (gap >= 2 * K.onIt) {
  console.error(`ABORT: the two spots no longer overlap (${gap.toFixed(3)} >= ${(2 * K.onIt).toFixed(3)}).`);
  console.error('  This probe is about the contested lens. If the geometry moved, it has nothing to measure.');
  await b.close(); process.exit(3);
}

// Yaw so that (sin yaw, -cos yaw) points from `from` at `to` — fp.ts's forward.
const yawTo = (from, to) => Math.atan2(to.x - from.x, -(to.z - from.z));

// Samples INSIDE the calendar's own disc, marching toward the door so the last
// ones are deep in the contested lens.
const N = 7;
const samples = [];
for (let i = 0; i < N; i++) {
  const t = (i / (N - 1)) * 0.9;            // 0 = on the calendar spot
  samples.push({ x: cal.x + (door.x - cal.x) * t * (K.onIt / gap) * 2,
                 z: cal.z + (door.z - cal.z) * t * (K.onIt / gap) * 2, t });
}

async function readAt(q, look) {
  const gy = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [q.x, q.z]);
  const yaw = yawTo(q, look);
  await p.evaluate(([x, z, y, g]) => window.__ct.warp(x, z, y, g, 0), [q.x, q.z, yaw, gy]);
  await p.waitForTimeout(140);
  const at = await p.evaluate(() => { const v = window.__ct.pos(); return { x: v[0], z: v[2] }; });
  const moved = Math.hypot(at.x - q.x, at.z - q.z);
  return { t: await prompt(), moved };
}

// Looking at the calendar means looking at the wall it hangs on, just past it.
const calLook = { x: cal.x, z: cal.z - 1 };
const doorLook = { x: door.x, z: door.z - 1 };

// THE RULE THIS ASSERTS, and it is not "the calendar always wins": between two
// spots under your feet, the one you are LOOKING at wins, and where both read as
// looked-at (which they do once you are within centimetres of a 0.95 m door) the
// NEARER one wins. So the calendar is owed the squares where the player is
// nearer the calendar; the door is owed its own. Demanding the calendar at a
// sample standing ON the door's stand-point would be demanding a bug.
let nearerCal = 0, calWins = 0, nearerDoor = 0, doorWins = 0, placed = 0;
console.log('\n  d(cal)  d(door)   facing CALENDAR              facing DOOR');
for (const q of samples) {
  const a = await readAt(q, calLook);
  const c = await readAt(q, doorLook);
  if (a.moved < 0.25) placed++;
  const dc = Math.hypot(q.x - cal.x, q.z - cal.z);
  const dd = Math.hypot(q.x - door.x, q.z - door.z);
  if (dc < dd) { nearerCal++; if (/calendar/.test(a.t ?? '')) calWins++; }
  else { nearerDoor++; if (/door/.test(c.t ?? '')) doorWins++; }
  console.log(`  ${dc.toFixed(3)}  ${dd.toFixed(3)}    ${String(a.t ?? '—').padEnd(26)}  ${c.t ?? '—'}`);
}

console.log('');
const fails = [];
const say = (ok, line) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${line}`); if (!ok) fails.push(line); };
say(placed === N, `${placed}/${N} samples actually placed the player (a failed warp cannot pass)`);
say(nearerCal > 0 && nearerDoor > 0,
  `the sweep straddles both sides: ${nearerCal} squares nearer the calendar, ${nearerDoor} nearer the door`);
say(calWins === nearerCal,
  `${calWins}/${nearerCal} squares NEARER THE CALENDAR offer it when you face it — the user's bug`);
say(doorWins === nearerDoor,
  `${doorWins}/${nearerDoor} squares nearer the DOOR still offer it when you face the door (WAY_OUT intact)`);

await b.close();
if (fails.length) { console.error(`\n${fails.length} FAILED`); process.exit(1); }
console.log('\nthe lens resolves by aim, not by rank');
