// CAN YOU ACTUALLY SIT ON THEM.
//
// The user reported not being able to sit on a bench, and nothing in my
// battery could have found it: `E-benchface` proves a bench FACES the park,
// which is about the seated view, and says nothing about whether you can
// reach the seat. A seat you cannot walk to is furniture, not a seat.
//
// Two ways it fails, and both have happened here:
//   GOTCHAS 8 — a collider sits over the [E] trigger. The seat is registered,
//     the prompt never appears, and from the player's side the bench is dead.
//   The approach lands BEHIND the bench. Then sitting down means walking round
//     the back of it, which nobody does, and it only takes one obstacle back
//     there to make the bench unusable.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4182/';
const b = await chromium.launch();
const page = await b.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);

// EVERY SEAT I OWN, NOT JUST THE PARK'S.
//
// This filtered to the park box and E-verify advertised it as "every seat can
// actually be reached" — so a green here said nothing about the LIBRARY
// COURTYARD benches, which are the subject of a user request in their own
// right: *"i cant sit at the benches at the library"* (FEATURE-REQUESTS.md:836).
// Nine seats checked, two ignored, and the description claimed all of them.
// Same shape as this suite's own worst habit: an entry point that promises
// completeness and quietly covers a subset (GOTCHAS 34, one level up).
const AREAS = [
  { name: 'park', minX: -39, maxX: -7, minZ: -99, maxZ: -67 },
  { name: 'library courtyard', minX: -13, maxX: -5, minZ: -22, maxZ: -4 },
];
// POSITIVE CONTROL: `E_EMPTY=1` points the library box at open road, where
// there are no seats. The per-area guard MUST exit 3. Without this the guard is
// a line nobody has watched run, and it is the line standing between "the
// library benches are fine" and "I did not look at the library benches".
if (process.env.E_EMPTY) {
  AREAS[1] = { name: 'library courtyard', minX: 300, maxX: 320, minZ: -22, maxZ: -4 };
  console.log('CONTROL: library box aimed at empty road — this MUST exit 3');
}
const seats = await page.evaluate((areas) => {
  const all = window.__ct.seats?.() ?? [];
  const mine = all.filter((s) => areas.some((a) =>
    s.pose.x > a.minX && s.pose.x < a.maxX && s.pose.z > a.minZ && s.pose.z < a.maxZ));
  const cols = window.__ct.colliders?.() ?? [];
  return mine.map((s) => {
    const area = areas.find((a) =>
      s.pose.x > a.minX && s.pose.x < a.maxX && s.pose.z > a.minZ && s.pose.z < a.maxZ);
    // RADIUS 0.36 is the player. A trigger you can only reach by standing
    // inside a wall is not reachable.
    const blocked = cols.some((c) =>
      s.at.x > c.minX - 0.36 && s.at.x < c.maxX + 0.36 &&
      s.at.z > c.minZ - 0.36 && s.at.z < c.maxZ + 0.36);
    // IN FRONT means in front of the SITTER. The pose yaw is the camera's, so
    // the sitter looks along (sin yaw, -cos yaw); the mesh's own front is the
    // other convention. Getting this backwards is what made a green here and
    // in E-benchface mean nothing.
    const fx = Math.sin(s.pose.yaw), fz = -Math.cos(s.pose.yaw);
    const dx = s.at.x - s.pose.x, dz = s.at.z - s.pose.z;
    const len = Math.hypot(dx, dz) || 1;
    return { x: +s.pose.x.toFixed(2), z: +s.pose.z.toFixed(2), blocked, area: area.name,
      infront: +((fx * dx + fz * dz) / len).toFixed(2), label: s.label };
  });
}, AREAS);

// PER AREA, so one area emptying cannot hide behind the other's count. The old
// guard was `seats.length < 5` over a single box; with two areas a total is not
// enough — the library's two could vanish and eleven-minus-two still clears any
// total you would pick.
const byArea = Object.fromEntries(AREAS.map((a) => [a.name, seats.filter((s) => s.area === a.name).length]));
console.log(`seats found: ${Object.entries(byArea).map(([k, v]) => `${v} in the ${k}`).join(', ')}`);
for (const [name, n] of Object.entries(byArea)) {
  if (n === 0) {
    console.log(`EXIT 3: no seats found in the ${name} — the locator is wrong, or they are gone.`);
    console.log('Either way this run cannot say they are reachable.');
    await b.close(); process.exit(3);
  }
}


let bad = 0;
for (const s of seats) {
  const why = s.blocked ? 'UNREACHABLE — a collider covers the trigger'
    : s.infront < 0.5 ? `approach is BEHIND the bench (${s.infront})` : '';
  if (why) bad++;
  console.log(`  ${why ? 'FAIL' : 'PASS'}  seat ${s.x},${s.z}  in-front ${s.infront}${why ? '  ' + why : ''}`);
}
console.log(bad ? `\n${bad} of ${seats.length} seats cannot be used as intended`
  : `\nall ${seats.length} seats I own are reachable, and approached from the front`);
await b.close();
process.exit(bad ? 1 : 0);
