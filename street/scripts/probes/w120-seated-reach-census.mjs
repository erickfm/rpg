// ITEM 289 — WHAT ELSE DID THE SEATED REACH LET IN, ACROSS ALL 219 SEATS?
//
// Item 289 widened the seated bound in `fp.ts:pickSpot` from `s.r +
// REACH_MARGIN` to `s.r + RADIUS + REACH_MARGIN`, because the old form measured
// the span from the player's CENTRE and so charged a sitting man the width of
// his own chest. That is +0.36 m of seated reach EVERYWHERE, and the item's own
// done-when is that item 188's seat distribution is otherwise unchanged.
//
// `w69-seated-offers.mjs` answers that where the data is thickest — it sits on
// every seat and reads the real prompt — but it faces each seat ONE way, its
// own yaw. So it cannot see a spot that the widening brought into range 40° off
// to the left. This probe closes that gap from the other side: it is a
// GEOMETRIC CENSUS, not a walk. At every seat it reads the live spot registry
// and reports every spot that is outside the OLD bound and inside the NEW one,
// at any heading.
//
// THAT IS DELIBERATELY AN UPPER BOUND, and saying so is the point. It ignores
// `lookTolerance` and `canSee`, both of which only ever REMOVE candidates — so
// a spot absent from this list cannot have been let in by the change at any
// heading whatsoever, which is the assertion `w69` cannot make. Anything that
// IS on the list still has to survive aim and line of sight before a player
// meets it.
//
// EVERY NUMBER COMES FROM THE WORLD: `__ct.reachMargin()`, `__ct.playerRadius()`,
// `__ct.seats()`, `__ct.spots()`. Nothing is retyped from `fp.ts` (BRIEF §8).
//
// SIT, DO NOT WARP. Seats live on several storeys and `seats()` does not publish
// one; `__ct.sit(pose)` puts the rig where the seat is with the storey the seat
// belongs to, and `spots()` evaluates every `ok()` at that vantage — a room's
// spots are gated on `room.inside()` and read from anywhere else the list is
// empty (GOTCHAS 50). Sitting BY IDENTITY, inside the page, is item 217's rule:
// a pose serialised out to node and back is a copy, and the modules that match
// their seat with `===` never fire on it.
//
//   SHOT_URL=http://localhost:4193/ node scripts/probes/w120-seated-reach-census.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4193/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.waitForTimeout(400);

const n = await p.evaluate(() => window.__ct.seats().length);
console.log(`${n} seats registered`);
// POPULATION FLOOR, GOTCHAS 71 — "nothing else was let in" is free over an
// empty set, and this check's whole value is that it swept everything.
if (n < 200) { console.log(`REFUSING TO REPORT: only ${n} seats visible`); await b.close(); process.exit(3); }

const consts = await p.evaluate(() => ({
  margin: window.__ct.reachMargin(), radius: window.__ct.playerRadius(),
}));
console.log(`REACH_MARGIN = ${consts.margin}   RADIUS = ${consts.radius}`);
console.log(`old seated bound  s.r + ${consts.margin}`);
console.log(`new seated bound  s.r + ${consts.radius} + ${consts.margin}\n`);

const gained = [];
let seated = 0;
await p.evaluate(() => window.__ct.clock(10, 0));   // the loan desk takes applications nine to four
for (let i = 0; i < n; i++) {
  const row = await p.evaluate(([k, margin, radius]) => {
    window.__ct.stand();
    const seat = window.__ct.seats()[k];
    window.__ct.sit(seat.pose);
    if (!window.__ct.seated()) return null;
    const q = window.__ct.pos();
    return {
      label: seat.label, x: q[0], z: q[2],
      // OUTSIDE the old bound and INSIDE the new one — the whole delta, at any
      // heading, before aim and sight get their say.
      // `spots()` PUBLISHES `ok`, IT DOES NOT APPLY IT — `crosstown.ts:1882`
      // maps every registered spot and hands the predicate's value out as a
      // field. `pickSpot` skips `!s.ok()` before anything else, so a census
      // that forgets this line is measuring dead spots: the first run of this
      // probe reported 156 seats "gaining" something, 119 of them the phrase
      // "sit at the slot" — every seat's own sit-spot carries
      // `ok: () => !rig.seated` (`crosstown.ts:455`, *"no seat can be hopped to
      // from another"*), so all of those were false the entire time.
      newly: (window.__ct.spots() || []).filter((s) => s.ok).map((s) => ({
        label: s.label, r: s.r, d: Math.hypot(s.x - q[0], s.z - q[2]),
      })).filter((s) => s.d >= s.r + margin && s.d < s.r + radius + margin)
        .sort((a, b) => a.d - b.d),
    };
  }, [i, consts.margin, consts.radius]);
  if (!row) continue;
  seated++;
  if (row.newly.length) gained.push({ i, ...row });
}
await p.evaluate(() => window.__ct.stand());
console.log(`sat on ${seated} of ${n}`);
console.log(`${gained.length} seat(s) can now reach something they could not before:\n`);
for (const g of gained) {
  console.log(`  seat ${g.i}/${n} "${g.label}" @ ${g.x.toFixed(2)},${g.z.toFixed(2)}`);
  for (const s of g.newly) {
    console.log(`      + "${s.label}"  d ${s.d.toFixed(2)}  r ${s.r.toFixed(2)}`
      + `  (old bound ${(s.r + consts.margin).toFixed(2)}, new ${(s.r + consts.radius + consts.margin).toFixed(2)})`);
  }
}
if (!gained.length) console.log('  (none — then the change bought nothing, which is its own failure)');
await b.close();
