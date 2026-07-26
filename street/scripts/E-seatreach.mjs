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

const seats = await page.evaluate(() => {
  const all = window.__ct.seats?.() ?? [];
  const park = all.filter((s) => s.pose.x > -39 && s.pose.x < -7 && s.pose.z > -99 && s.pose.z < -67);
  const cols = window.__ct.colliders?.() ?? [];
  return park.map((s) => {
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
    return { x: +s.pose.x.toFixed(2), z: +s.pose.z.toFixed(2), blocked,
      infront: +((fx * dx + fz * dz) / len).toFixed(2), label: s.label };
  });
});

if (seats.length < 5) {
  console.log(`only ${seats.length} park seats found — EXIT 3, the locator is wrong, not the park`);
  await b.close(); process.exit(3);
}
let bad = 0;
for (const s of seats) {
  const why = s.blocked ? 'UNREACHABLE — a collider covers the trigger'
    : s.infront < 0.5 ? `approach is BEHIND the bench (${s.infront})` : '';
  if (why) bad++;
  console.log(`  ${why ? 'FAIL' : 'PASS'}  seat ${s.x},${s.z}  in-front ${s.infront}${why ? '  ' + why : ''}`);
}
console.log(bad ? `\n${bad} of ${seats.length} park seats cannot be used as intended`
  : `\nall ${seats.length} park seats are reachable, and approached from the front`);
await b.close();
process.exit(bad ? 1 : 0);
