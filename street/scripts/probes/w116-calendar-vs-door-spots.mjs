// Item 291 — HOW FAR APART ARE THE CALENDAR'S STAND-POINT AND THE DOOR'S?
//
// Three ranking schemes failed to give the door the band, and the fourth made
// things worse. This measures the geometry the row never states, because it is
// the number that decides whether ANY ranking scheme can work.
//
// `pickSpot`'s `onIt` rule — the spot's centre is inside the player's own
// collision capsule, `RADIUS` — is UNBEATABLE by construction, and it has to be:
// it is what holds `seats-walk`'s standing assertion, `w40`'s END ONE(b), and
// the user's own guard rail for this very item (*"standing right at a piece of
// furniture and looking straight at it must still offer that furniture"*).
//
// So if the calendar's stand-point sits within one capsule of the route out,
// the calendar is `onIt` while he walks past it, and no rank can lift the door
// over it without destroying the rule the guard rail rests on.
//
// Usage: SHOT_URL=http://localhost:4720/ node scripts/probes/w116-calendar-vs-door-spots.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4720/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await p.goto(URL, { waitUntil: 'load', timeout: 30000 });
await p.waitForFunction(() => {
  const q = window.__ct?.painted?.();
  return !!q && q.frames > 0 && q.triangles > 0;
}, { timeout: 30000 });

// The player SPAWNS in 301 (GOTCHAS 79b), so the flat's spots are already live.
const spots = await p.evaluate(() => (window.__ct.spots() ?? [])
  .map((s) => ({ label: String(typeof s.label === 'function' ? s.label() : s.label), x: +s.x.toFixed(3), z: +s.z.toFixed(3), r: s.r, rank: s.rank ?? 0 }))
  .filter((s) => /calendar|door|bed/i.test(s.label)));
for (const s of spots) console.log(`  "${s.label}"  x${s.x} z${s.z}  r${s.r}  rank ${s.rank}`);

const cal = spots.find((s) => /calendar/i.test(s.label));
const door = spots.find((s) => /the door/i.test(s.label));
const bed = spots.find((s) => /bed/i.test(s.label));
const gap = (a, c) => Math.hypot(a.x - c.x, a.z - c.z);
const RADIUS = await p.evaluate(() => window.__ct?.radius?.() ?? null);
console.log(`\nplayer capsule RADIUS from the world: ${RADIUS ?? '(not published — fp.ts:RADIUS is 0.36)'}`);
const R = RADIUS ?? 0.36;

if (cal && door) {
  const g = gap(cal, door);
  console.log(`\ncalendar stand-point -> door stand-point : ${g.toFixed(3)} m`);
  console.log(`  one capsule is ${R} m, so a player standing ON the door spot is`);
  console.log(`  ${(g - R).toFixed(3)} m outside the calendar's onIt circle.`);
  console.log(g < 2 * R
    ? '  ⚠ THE TWO onIt CIRCLES OVERLAP — there are poses where BOTH are "standing in it".'
    : '  the two onIt circles are disjoint.');
}
if (cal && bed) console.log(`calendar stand-point -> bed seat        : ${gap(cal, bed).toFixed(3)} m`);
if (door && bed) console.log(`door stand-point     -> bed seat        : ${gap(door, bed).toFixed(3)} m`);
await b.close();
