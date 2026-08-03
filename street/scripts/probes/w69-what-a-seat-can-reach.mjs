// WHICH SEATS IN THE WORLD HAVE ANYTHING TO REACH FOR?
//
// Item 188 gives a seated player `[E]` on what they are aiming at, bounded by
// the spot's own `r + RADIUS + REACH_MARGIN` (`fp.ts:1236`; the `+ RADIUS` is
// the player's own body and landed with item 289 — `d` runs from his CENTRE, so
// a bound without it charges a seated player the width of his own chest and
// under-reports the reach by 0.36 m). `w69-seated-offers.mjs` reports what each
// seat offers with the head STRAIGHT AHEAD, which is 219/219 "stand up" — the
// regression answer, and the reason the change is safe.
//
// This asks the other half: turn your head, and is there anything there AT ALL?
// It is a pure geometry read over `__ct.seats()` × `__ct.spots()` — no walking,
// no sitting — so it answers for the whole world in one page load and says
// which rooms the new capability actually reaches.
//
// The answer is the useful part of the handoff: a seat with nothing in range is
// a seat this change cannot alter however the player turns.
//
//   SHOT_URL=http://localhost:4250/ node scripts/probes/w69-what-a-seat-can-reach.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4250/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.waitForTimeout(400);

const { seats, spots, margin, radius } = await p.evaluate(() => ({
  seats: window.__ct.seats(), spots: window.__ct.spots(),
  // BUILDER-BRIEF §8: both halves of the bound are published (`__ct.reachMargin`,
  // `__ct.playerRadius`) precisely so no script has to retype fp.ts's 0.6 or its
  // 0.36 — two of them used to.
  margin: window.__ct.reachMargin(), radius: window.__ct.playerRadius(),
}));
console.log(`${seats.length} seats, ${spots.length} spots, REACH_MARGIN ${margin}, RADIUS ${radius}\n`);
if (![margin, radius].every((v) => typeof v === 'number' && isFinite(v))) {
  console.log('REFUSING TO REPORT: the seated bound could not be read'); await b.close(); process.exit(3);
}
if (seats.length < 200 || spots.length < 100) {
  console.log('REFUSING TO REPORT: the population collapsed'); await b.close(); process.exit(3);
}

const rows = [];
for (const s of seats) {
  const near = spots
    .map((sp) => ({ sp, d: Math.hypot(sp.x - s.pose.x, sp.z - s.pose.z) }))
    // The seat's OWN sit spot is dead while you are on it (`ctx.seat`'s `ok`
    // is `!rig.seated`), so it can never be a candidate and is not counted.
    .filter((r) => r.d < r.sp.r + radius + margin && !/^sit |^take a |watch tv/i.test(r.sp.label))
    .sort((a, b2) => a.d - b2.d);
  if (near.length) rows.push({ s, near });
}
console.log(`seats with something inside arm's reach: ${rows.length} of ${seats.length}\n`);
const byLabel = new Map();
for (const r of rows) {
  const k = `${r.s.label}  ->  ${r.near.map((n) => `${n.sp.label} (${n.d.toFixed(2)}m)`).join(' | ')}`;
  byLabel.set(k, (byLabel.get(k) ?? 0) + 1);
}
for (const [k, n] of [...byLabel].sort((a, b2) => b2[1] - a[1])) console.log(`  x${n}  ${k}`);

// The seats the item names by hand, whether or not they have anything: a
// negative answer about the library terminal is the finding, not a gap.
console.log('\nthe two seats item 188 names:');
for (const want of [/client chair/i, /computer|terminal|pc/i]) {
  const hits = seats.filter((s) => want.test(s.label));
  if (!hits.length) { console.log(`  ${want} — NO SUCH SEAT`); continue; }
  for (const s of hits.slice(0, 3)) {
    const near = spots.map((sp) => ({ sp, d: Math.hypot(sp.x - s.pose.x, sp.z - s.pose.z) }))
      .filter((r) => r.d < r.sp.r + margin).sort((a, b2) => a.d - b2.d);
    console.log(`  "${s.label}" @ ${s.pose.x.toFixed(2)},${s.pose.z.toFixed(2)}  ->  `
      + (near.length ? near.map((n) => `${n.sp.label} (${n.d.toFixed(2)}m)`).join(' | ') : 'NOTHING REGISTERED IN REACH'));
  }
}
await b.close();
