// ITEM 280 — item 93's occupied-seat suppression, measured from INSIDE.
//
// WHY THIS IS A SEPARATE PROBE. `__ct.spots()` evaluates every `ok()`, and the
// casino's seats read `room.inside() && !seatTaken(...)`. Standing anywhere
// else, all 123 of them come back `false` — not because a man is sitting on
// them but because you are not in the building. A census run from spawn
// therefore reports "123 registered, 0 offered" and cannot see item 93 at all.
// (The church's seats have no `inside()` term, which is why those 18 ARE
// readable from outside and why the row's church figure is the easy one.)
//
// The lounge sitter is one this change moves, and his `claimSeat` is exactly
// the call that a build-time offset would have corrupted. So: stand inside,
// count, and compare with the row's stated 87 registered / 83 offered / 4
// suppressed.
//
// Usage: SHOT_URL=http://localhost:4690/ node scripts/probes/w113-280-item93-inside.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { waitPainted } from '../lib/painted.mjs';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4690/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await waitPainted(p, { quiet: true });
await reportWorld(p, URL);

// `roomDims()` is INDEXED 0..12, not keyed by room id; the ids come from
// `rooms()` in the same order. Pair them. (Instrument note from worker
// onehundredeleven, and it is still true.)
const room = await p.evaluate(() => {
  const ids = window.__ct.rooms(), dims = window.__ct.roomDims();
  const i = ids.indexOf('casino');
  return i < 0 ? null : { id: ids[i], ...dims[i] };
});
if (!room) { console.error('MISS: no casino in rooms()'); process.exit(3); }

for (let k = 0; k < 8; k++) {
  await p.evaluate((r) => window.__ct.warp(r.cx, r.cz, 0, 0, 0), room);
  await waitPainted(p, { quiet: true }); await p.waitForTimeout(300);
  const q = await p.evaluate(() => window.__ct.pos());
  if (Math.hypot(q[0] - room.cx, q[2] - room.cz) < 3) break;
}
const at = await p.evaluate(() => window.__ct.pos());
console.log(`casino centre (${room.cx.toFixed(2)}, ${room.cz.toFixed(2)}), `
  + `standing (${at[0].toFixed(2)}, ${at[2].toFixed(2)})`);

const r = await p.evaluate(() => {
  if (window.__ct.seated()) return { seated: true };
  const spots = window.__ct.spots()
    .filter((sp) => /sit|stool|bench|seat/i.test(sp.label ?? ''));
  // the casino's own slab, so the church and the diner are not counted in
  const mine = spots.filter((sp) => sp.x > 860 && sp.x < 900);
  return { seated: false,
    n: mine.length, ok: mine.filter((sp) => sp.ok).length,
    suppressed: mine.filter((sp) => !sp.ok).map((sp) => [+sp.x.toFixed(2), +sp.z.toFixed(2)]) };
});
if (r.seated) { console.error('MISS: player is seated; every ok() is false'); process.exit(3); }

console.log(`\ncasino seats: ${r.n} registered, ${r.ok} offered, ${r.n - r.ok} suppressed`);
console.log(`suppressed at: ${JSON.stringify(r.suppressed)}`);

// ── THE BASELINE, AND WHY IT IS NOT THE ROW'S ─────────────────────────────
//
// The queue row states 87 registered / 83 offered / 4 suppressed. THAT IS
// STALE: measured on builds 2d67a99cb and its parent, from inside the room,
// this reads 123 / 111 / 12 — the same on both, coordinate for coordinate.
// Asserting the row's figure would have left a check that can only ever fail,
// which is worse than no check (BUILDER-BRIEF §7).
//
// So the assertion is the INVARIANT the change had to preserve: the exact set
// of suppressed seats, unchanged. Five of the twelve are the sitters
// themselves (four slot players and the lounge bench), and [878.52, 14.98] is
// the lounge seat under the figure this change MOVES by 0.115 m — the one that
// would have gone wrong had the offset been applied at build time, before
// `claimSeat` reads the mesh back.
// ── THE NEGATIVE CASE, RUN, AND THE FIRST TWO ATTEMPTS BOTH PASSED ───────
//
// A check nobody has watched fail is a check you will argue with (GOTCHAS 27),
// so this one was made to fail on the exact fault it guards: the seat offset
// applied at BUILD time, before `claimSeat` reads the mesh back.
//
//   attempt 1  `+= sin(facing) * seatFwd` right after citizenSprite()  -> PASSED
//              Not because the world was fine: `put()` runs next and sets the
//              position ABSOLUTELY, so the mutation was erased before it could
//              do harm. A mutation upstream of an absolute write tests nothing.
//   attempt 2  the same line with a hard 0.5 m, same place              -> PASSED
//              Same reason. The size was never the problem.
//   attempt 3  0.5 m between `put()` and `claimSeat()`                  -> FAILED
//              123/112/11, and [878.52, 14.98] — the lounge seat under the
//              figure this change moves — dropped out of the suppressed set.
//              Exit 1. That is the regression item 93 exists to prevent.
//
// WHAT THAT MEASURES, and it corrects the scoping note: at the sizes actually
// shipped a build-time offset would ALSO have been safe here, because the
// casino's offset is 0.115 m against `seatTaken`'s 0.30 m tolerance, and the
// diner (0.275 m) registers its booth seats with `ok: room.inside` and never
// consults `seatTaken` at all. The update()-time ordering is therefore
// DEFENSIVE FOR THE NEXT ADOPTER rather than load-bearing today — it stops
// mattering at 0.30 m, which is where the next deeper seat will land.
const BASELINE = [[870.6, 10.63], [876.76, 10.97], [872.52, 7.77], [878.68, 1.03],
  [878.52, 14.98], [889.56, 2.98], [889.56, 4.02], [888.61, 1.8], [888.61, 5.2],
  [887.73, 10.25], [889.63, 10.25], [888.68, 7.7]];
const key = (a) => JSON.stringify([...a].sort());
const held = r.n === 123 && r.ok === 111 && key(r.suppressed) === key(BASELINE);
console.log(held
  ? '\nITEM 93 HOLDS — 123/111/12, suppressed set identical to the baseline'
  : `\nITEM 93 MOVED — ${r.n}/${r.ok}/${r.n - r.ok}; investigate before shipping`);
console.log('(the row\'s 87/83/4 is stale — it does not describe this world)');
await b.close();
process.exit(held ? 0 : 1);
