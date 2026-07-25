// Builder G — approach-corridor probe for the four rooms in my queue.
//
// The [E] spot for an interior has to sit where the player can actually REACH,
// and GOTCHAS §8 is the reason: a collider that overlaps the approach silently
// eats the trigger, which is how the bodega became un-enterable. `warp` does no
// collision resolution, so warping onto a spot proves nothing. This walks in.
//
// For each door: stand back on the walk, walk INTO the facade, and report the
// closest the capsule actually gets — then walk the length of the frontage to
// prove the lane past it is clear (GOTCHAS §9, the 2 m lane is sacred).
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4186/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });

const at = () => p.evaluate(() => window.__ct.pos());
const warp = (x, z, yaw, gy) => p.evaluate(([x, z, yaw, gy]) => window.__ct.warp(x, z, yaw, gy), [x, z, yaw, gy]);
const hold = async (key, ms) => {
  await p.keyboard.down(key); await p.waitForTimeout(ms); await p.keyboard.up(key);
  await p.waitForTimeout(120);
};

// yaw convention (fp.ts:86): fwd = (sin yaw, 0, -cos yaw)
const NORTH_z = Math.PI;      // +z  — into the side-street north facade
const EAST_x = Math.PI / 2;   // +x
const WEST_x = -Math.PI / 2;  // -x

const KERB = 0.14;
const f2 = (n) => n.toFixed(2);

// ── the doors, as computed from the rosters ──────────────────────────────
// side street: NORTH2 facades on z = -96.0, walk band z ∈ (-98, -96)
// east block:  facades on x = +7.0, walk band x ∈ (5, 7)
const DOORS = [
  { nm: 'GOLDEN ACES (casino)', axis: 'z', door: 51.29, standoff: -97.6, into: NORTH_z },
  { nm: 'HOTEL ORPHEUS', axis: 'z', door: 39.51, standoff: -97.6, into: NORTH_z },
  { nm: 'A-1 TAX', axis: 'x', door: -15.25, standoff: 5.6, into: EAST_x },
  { nm: 'PAWN (no painted door)', axis: 'x', door: -59.0, standoff: 5.6, into: EAST_x },
];

console.log('door                        approach reaches   ground   verdict');
for (const d of DOORS) {
  // stand back on the walk, in line with the door, and walk into the facade
  if (d.axis === 'z') await warp(d.door, d.standoff, d.into, KERB);
  else await warp(d.standoff, d.door, d.into, KERB);
  await p.waitForTimeout(250);
  await hold('w', 1400);
  const [x, , z, gy] = await at();
  const reach = d.axis === 'z' ? z : x;
  const gap = Math.abs(reach - (d.axis === 'z' ? -96.0 : 7.0));
  // an [E] spot at r = 1.05 hung on the facade is reachable if the capsule
  // stops within 1.05 m of it
  const ok = gap < 1.05 + 0.001;
  console.log(
    `${d.nm.padEnd(26)} ${d.axis}=${f2(reach).padStart(7)}      ${f2(gy)}    ` +
    `${ok ? 'REACHABLE' : 'BLOCKED'}  (${f2(gap)} m off the facade)`);
}

// ── the lane along each frontage ─────────────────────────────────────────
// walk the full side-street frontage from the bodega corner out to the east
// end, on the walk, and report where (if anywhere) forward progress stops
console.log('\nlane along the north side-street walk (z = -97.1):');
await warp(14, -97.1, EAST_x, KERB);
await p.waitForTimeout(250);
let last = 14;
for (let i = 0; i < 12; i++) {
  await hold('w', 700);
  const [x] = await at();
  if (x - last < 0.15) { console.log(`  STUCK at x = ${f2(x)}`); break; }
  last = x;
}
console.log(`  walked from x = 14.00 to x = ${f2(last)}  (casino door 51.29, cross building 56.70)`);

console.log('\nlane along the east walk past the tax office (x = 5.9):');
await warp(5.9, -9.5, Math.PI, KERB);   // facing +z? no: walk south = -z
await warp(5.9, -9.5, 0, KERB);         // yaw 0 = -z, south past the tax office
await p.waitForTimeout(250);
last = -9.5;
for (let i = 0; i < 10; i++) {
  await hold('w', 700);
  const [, , z] = await at();
  if (last - z < 0.15) { console.log(`  STUCK at z = ${f2(z)}`); break; }
  last = z;
}
console.log(`  walked from z = -9.50 to z = ${f2(last)}  (tax door -15.25, pawn door -59.00)`);

await b.close();
