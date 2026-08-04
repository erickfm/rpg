// NOTHING MAY PLANT ITS STAND-POINT IN A DOORWAY. (Item 291, the general form.)
//
// *"just make the door high rank pls."* — the user, 2026-08-03. Rank is half the
// answer; this is the other half, and it is the half that is a PROPERTY OF
// STAND-POINTS rather than a fix for one room.
//
// THE RULE, and it is derived rather than chosen:
//
//   Two stand-points closer than `2 * RADIUS` have OVERLAPPING "standing in it"
//   circles. `fp.ts`'s tier 1 admits a spot without any aim test when its centre
//   is inside your own capsule (`onIt`, `d < RADIUS`), and inside an overlap
//   BOTH are admitted at once — so the player is standing in two things and no
//   amount of aiming can separate them. Worker onehundredsixteen measured this
//   the expensive way: four different ranking schemes, none of which could give
//   the door the band, because ranking is not the tool for a geometry problem.
//
// So: **no spot's stand-point may be within `2 * RADIUS` of a WAY-OUT spot's.**
// A way out is not just another thing in the room — it is the thing you need
// when you cannot work out what else to press, and the user has now said so.
// Furniture-vs-furniture overlaps are NOT flagged: the casino floor is ~70
// deliberately-adjacent slot stools, and a rule that fails on those is a rule
// nobody can keep.
//
// EVERY NUMBER IS ASKED OF THE WORLD. `RADIUS` comes from `__ct.playerRadius()`
// and the rank from `__ct.spots()`, so re-tuning the player's capsule moves this
// guard with it and neither can drift into agreeing with itself (BUILDER-BRIEF
// §8). Nothing here is retyped from source.
//
// ── AND IT IS DELIBERATELY NOT A WALK (BUILDER-BRIEF §10a) ───────────────────
//
// The user, 2026-08-03: *"in general i think we should keep tests that are cheap
// but stay away from tests that are failure prone. i will be reviewing anyway
// yknow?"* and *"in general tests should not take longer than the work to code
// itself"*.
//
// The fix this defends is ONE CONSTANT. So the standing assertion is a `__ct`
// read: it loads the page once, asks `spots()`, `playerRadius()` and
// `pickSpot()`, and answers in milliseconds with no camera, no strides and no
// render-loop timing. It fails when the geometry actually breaks and at no other
// time. The five-run walked version of the same facts is
// The walked version of the same facts was run 5/5 green when this landed and
// record, run by nothing, exactly as BUILDER-BRIEF §7a intends. It was run 5/5
// green when the change landed and it is not a suite leg.
//
// WHAT THE CHEAP FORM CANNOT SEE, said plainly rather than left as a surprise:
// `pickSpot` here is called WITHOUT the line-of-sight filter (the hook cannot
// supply it — `update()`'s raycast starts at the player's own eye), and it
// samples poses rather than routes. A regression that is purely about occlusion,
// or purely about how a stride lands, will pass this and needs the walk.
//
// ── --selftest: CAN THIS GO RED? ────────────────────────────────────────────
// It widens the overlap limit to 3x and requires the world to trip it. If the
// detector still reports "clean" at 2.16 m it is not detecting, and the flag
// exits non-zero. A guard whose failure path has never executed is a guard
// nobody has tested (BUILDER-BRIEF §7).
//
//   SHOT_URL=http://localhost:4189/ node scripts/standpoint-overlap.mjs
//   SHOT_URL=http://localhost:4189/ node scripts/standpoint-overlap.mjs --selftest
//
// exit 0 clean · 1 a way out is contested, or a pose resolves wrong · 3 nothing measured
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const SELFTEST = process.argv.includes('--selftest');
const URL = aim('http://localhost:4189/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.waitForTimeout(1500);
await reportWorld(p, URL);

const hooks = await p.evaluate(() => ({
  spots: typeof window.__ct.spots, playerRadius: typeof window.__ct.playerRadius,
  pickSpot: typeof window.__ct.pickSpot, warp: typeof window.__ct.warp,
  groundAt: typeof window.__ct.groundAt,
}));
if (Object.values(hooks).some((t) => t !== 'function')) {
  console.error(`ABORT (exit 3): __ct is missing a hook — ${JSON.stringify(hooks)}`);
  await b.close(); process.exit(3);
}

// EVERY spot, not just the live ones. `ok()` is evaluated where the PLAYER is
// standing, so filtering on it here would hide every room he is not currently
// in — which is all of them but one, and this is a question about the whole
// world's geometry rather than about one storey.
// ⚠ `onItRadius()`, NOT `playerRadius()`, SINCE ITEM 309. They were the same
// number until the user asked for less reach on the interactables — `RADIUS` is
// now only the player's COLLISION capsule, and the resolver's tier-1 test reads
// a separate, trimmed `ON_IT` (0.288 against 0.36). This file is about tier 1,
// so it wants the second one; reading the first over-reports every overlap by
// 20% and would report contested corners that the world resolves cleanly.
// Falls back to `playerRadius()` on a build that predates the split.
const { spots, RADIUS } = await p.evaluate(() => ({
  spots: window.__ct.spots(),
  RADIUS: window.__ct.onItRadius ? window.__ct.onItRadius() : window.__ct.playerRadius(),
}));
if (!Array.isArray(spots) || spots.length === 0 || !Number.isFinite(RADIUS)) {
  console.error(`ABORT (exit 3): nothing to measure — ${spots?.length} spots, RADIUS ${RADIUS}`);
  await b.close(); process.exit(3);
}

// ── ITEM 291'S TWO ACCEPTANCE FACTS, AS POSES RATHER THAN AS A WALK ─────────
//
// The player is warped INTO 301 once, so the flat's `ok()` predicates go live —
// they gate on storey and nothing in this room registers from the street. Then
// `pickSpot` is asked about poses the player is not standing in, which is the
// whole reason that hook returns numbers instead of the live Spot.
const poses = [];
{
  const gy = await p.evaluate(() => window.__ct.groundAt(199.36, -15.545));
  await p.evaluate(([gy]) => window.__ct.warp(199.36, -15.545, 0, gy, 0), [gy]);
  await p.waitForTimeout(500);
  const live = await p.evaluate(() => window.__ct.spots().filter((s) => s.ok && s.x > 190 && s.x < 210));
  const g = (re) => live.find((q) => re.test(q.label));
  const door = g(/the door/i), cal = g(/calendar/i), bed = g(/bed/i);
  if (!door || !cal || !bed) {
    console.error('ABORT (exit 3): 301 does not register door + calendar + bed; nothing was asserted.');
    await b.close(); process.exit(3);
  }
  const bearing = (from, to) => Math.atan2(to.x - from.x, -(to.z - from.z));
  const ask = async (at, yaw) =>
    p.evaluate(([x, z, y]) => {
      const w = window.__ct.pickSpot({ x, z, yaw: y, pitch: 0 }, { reach: 6 });
      return w ? w.label : null;
    }, [at.x, at.z, yaw]);

  // (1) FACING THE DOOR FROM THREE DISTANCES, on the line out of the flat.
  // The stand-offs clear the BED's own capsule — at 1.2 m from the door you are
  // 0.07 m from the bed seat, i.e. standing IN the bed, where the user's guard
  // rail says the bed must win. That is the rule working, not a failure.
  const ux = (door.x - bed.x), uz = (door.z - bed.z);
  const L = Math.hypot(ux, uz);
  for (const off of [0.85, 0.62, 0.40]) {
    const t = (L - off) / L;
    const at = { x: bed.x + ux * t, z: bed.z + uz * t };
    const got = await ask(at, bearing(at, door));
    poses.push({ what: `facing the door from ${off.toFixed(2)} m`, got, ok: /door/i.test(got ?? '') });
  }
  // (2) AT THE CALENDAR, FACING IT. The calendar hangs on the south wall; face
  // the WALL, not the stand-point, or this asserts nothing about aim.
  const got = await ask(cal, bearing(cal, { x: cal.x, z: cal.z - 1.0 }));
  poses.push({ what: 'at the calendar, facing it', got, ok: /calendar/i.test(got ?? '') });
}
await b.close();

// x3 under --selftest, so the detector has to find something it otherwise would
// not. The mutation is to the INSTRUMENT's threshold, not to the world — this
// check only ever reads, so there is nothing in the world for it to break.
const LIMIT = 2 * RADIUS * (SELFTEST ? 3 : 1);
const ways = spots.filter((s) => (s.rank ?? 0) > 0);
console.log(`${spots.length} registered spots, ${ways.length} of them a WAY OUT (rank > 0)`);
console.log(`ON_IT ${RADIUS} m, so two "standing in it" discs is ${LIMIT.toFixed(2)} m — the overlap limit\n`);

// A WAY OUT WITH NO RANK ANYWHERE IN THE WORLD IS THE CHECK FAILING SILENTLY,
// not the world being clean. GOTCHAS 34: a check can pass because it found
// nothing to check.
if (ways.length === 0) {
  console.error('ABORT (exit 3): no spot in the world declares rank > 0, so this measured');
  console.error('  NOTHING. Either `WAY_OUT` stopped being declared or `spots()` stopped');
  console.error('  publishing `rank`. Both are bugs; neither is a clean world.');
  process.exit(3);
}

const bad = [];
for (const w of ways) {
  for (const s of spots) {
    if (s === w) continue;
    if ((s.rank ?? 0) > 0) continue;          // two ways out may share a threshold
    const d = Math.hypot(s.x - w.x, s.z - w.z);
    if (d < LIMIT) bad.push({ d, w, s });
  }
}
bad.sort((a, c) => a.d - c.d);

for (const { d, w, s } of bad) {
  console.log(`  ${d.toFixed(3)} m  "${s.label}" (${s.x.toFixed(2)}, ${s.z.toFixed(2)})`);
  console.log(`            stands inside the way out "${w.label}" (${w.x.toFixed(2)}, ${w.z.toFixed(2)})`);
  console.log(`            overlap ${(LIMIT - d).toFixed(3)} m — poses exist where the player is standing in both`);
}
if (!bad.length) {
  console.log('  clean — no furniture stand-point sits inside a way out\'s.');
  // The one this item moved, reported by name so the fix is visible and not
  // merely absent: it was 0.468 m and is now clear.
  const cal = spots.find((s) => /calendar/i.test(s.label));
  const door = ways.find((s) => /the door/i.test(s.label));
  if (cal && door) {
    console.log(`  (301's calendar stands ${Math.hypot(cal.x - door.x, cal.z - door.z).toFixed(3)} m `
      + `from its door — it was 0.468 m before item 291.)`);
  }
}
// ── THE KNOWN BASELINE, NAMED, AND IT IS ALLOWED TO SHRINK BUT NOT TO GROW ──
//
// Four overlaps exist today and all four are the walk-up's PARCELS: `steal
// <n>'s package` sits 0.410 m from the hall-side stand-point of the door it is
// leaning against. **That is a different case from the calendar's and it is not
// obviously wrong.** The calendar's stand-point was a patch of empty floor in
// the middle of a walking route; a parcel's spot is the PARCEL — a physical
// object registered where it physically is (`pkgPos`, `ct/apartment.ts:2431`),
// and moving it would move the prompt off the thing it names. Item 291 did not
// touch it, and the resolver map says nothing became unreachable: the parcel
// still wins at its own position, because `onIt` outranks rank.
//
// So the baseline is 4, it is written down here rather than silently tolerated,
// and this still FAILS on a fifth (BUILDER-BRIEF §7 — a check that cannot fail
// is worse than one that is wrong). If somebody fixes the parcels this goes red
// and the number comes down by hand, which is the right way round for a debt
// that is meant to shrink.
const PARCEL = /package|pockets full/i;
const unexpected = bad.filter((q) => !PARCEL.test(q.s.label));
const BASELINE = 4;
if (unexpected.length) {
  console.log(`\n⚠ ${unexpected.length} overlap(s) are NOT the known parcels — this is new:`);
  for (const q of unexpected) console.log(`    "${q.s.label}" vs "${q.w.label}" at ${q.d.toFixed(3)} m`);
} else if (bad.length > BASELINE) {
  console.log(`\n⚠ parcel overlaps went ${BASELINE} -> ${bad.length}`);
}

console.log('\nflat 301, the two facts item 291 is about:');
for (const q of poses) console.log(`  ${q.ok ? 'ok  ' : 'FAIL'}  ${q.what} -> [E] ${q.got ?? '(none)'}`);
const badPoses = poses.filter((q) => !q.ok).length;

if (SELFTEST) {
  const tripped = unexpected.length > 0 || bad.length > BASELINE;
  console.log(`\n--selftest: limit widened to ${LIMIT.toFixed(2)} m — detector `
    + `${tripped ? 'TRIPPED, as it must' : 'STAYED SILENT, so it is not detecting'}`);
  process.exit(tripped ? 0 : 1);
}
const grew = unexpected.length > 0 || bad.length > BASELINE;
console.log(`\n${bad.length} contested way${bad.length === 1 ? '' : 's'} out `
  + `(baseline ${BASELINE}, all parcels)${grew ? ' — GREW' : ''}, ${badPoses} pose${badPoses === 1 ? '' : 's'} wrong`);
process.exit(grew || badPoses ? 1 : 0);
