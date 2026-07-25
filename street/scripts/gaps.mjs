// Find gaps the player can walk INTO but not OUT of.
//
// The capsule is RADIUS = 0.36, so 0.72 m across. A corridor between two solid
// boxes should be either comfortably passable (>= 0.95 m) or too narrow to
// enter (< 0.40 m). In between is the trap the user got wedged in: wide enough
// to walk into at an angle, too narrow to turn round or walk out of.
//
// This cannot be found by walking, and it cannot be seen in a screenshot,
// because the parked arrangement is DRAWN from the seeded distribution — the
// trap exists in some arrangements and not others. So measure the geometry.
//
// Usage: SHOT_URL=http://localhost:4187/ node scripts/gaps.mjs [--all]
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

let PASSABLE = 0.95, ENTERABLE = 0.40;   // replaced by the world's own values below
const showAll = process.argv.includes('--all');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message)));
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct?.colliders !== undefined, { timeout: 10000 });
await reportWorld(page, process.env.SHOT_URL ?? 'http://localhost:4177/');   // GOTCHAS 26: prove it, do not just name it
await page.waitForTimeout(300);

// Ask the world for the RULE and the predicate rather than reimplementing them.
// This probe used to carry its own copy of `corridor()` and the two drifted:
// they disagreed about a pair that overlapped on neither axis, so a reported
// trap could not be settled without stepping through both. One implementation.
const rule = await page.evaluate(() => window.__ct.gapRule());
ENTERABLE = rule.ENTERABLE; PASSABLE = rule.PASSABLE;

// The whole pairwise scan runs INSIDE the page, calling ct/gap.ts's own
// corridor() for every pair. Doing it out here would be 9,000 round trips, and
// re-implementing the predicate is what caused the drift this replaces.
const traps = await page.evaluate(async ([lo, hi]) => {
  // ── only STATIC boxes ────────────────────────────────────────────────────
  //
  // Six of the colliders in this world MOVE: the citizens, whose footprints are
  // 0.5 x 0.5 and walk the pavements. A pedestrian passing a parked car forms a
  // 0.78 m corridor for about a second and then walks out of it, and this probe
  // used to report that as a parking defect — which is why the build-time
  // constraint kept reporting success while the probe kept failing. They were
  // both right; they were looking at different moments.
  //
  // You cannot constrain a draw against something that moves, and a person
  // standing near a car is not a trap: they leave. So sample twice and keep only
  // the boxes that stayed put. (The traffic vehicles park their boxes at 999
  // while idle, which the range filter already drops.)
  const key = (q) => `${q.minX.toFixed(3)},${q.minZ.toFixed(3)},${q.maxX.toFixed(3)},${q.maxZ.toFixed(3)}`;
  const first = window.__ct.colliders().map(key);
  await new Promise((r) => setTimeout(r, 1200));
  const now = window.__ct.colliders();
  const solid = now.filter((q, i) => key(q) === first[i]
    && Math.abs(q.minX) < 400 && Math.abs(q.minZ) < 400);
  const out = [];
  const dims = (q) => `${(q.maxX - q.minX).toFixed(2)}x${(q.maxZ - q.minZ).toFixed(2)}`;
  for (let i = 0; i < solid.length; i++) {
    for (let j = i + 1; j < solid.length; j++) {
      const a = solid[i], b = solid[j];
      const w = window.__ct.corridor(a, b);
      if (w === null || !(w > lo && w < hi)) continue;
      // which axis the slot runs on, for the report only
      const overlapZ = a.minZ < b.maxZ && b.minZ < a.maxZ;
      const axis = overlapZ ? 'x' : 'z';
      const x = axis === 'x' ? (Math.min(a.maxX, b.maxX) + Math.max(a.minX, b.minX)) / 2
        : (Math.max(a.minX, b.minX) + Math.min(a.maxX, b.maxX)) / 2;
      const z = axis === 'z' ? (Math.min(a.maxZ, b.maxZ) + Math.max(a.minZ, b.minZ)) / 2
        : (Math.max(a.minZ, b.minZ) + Math.min(a.maxZ, b.maxZ)) / 2;
      out.push({ w: +w.toFixed(3), axis, x: +x.toFixed(2), z: +z.toFixed(2),
        pair: `${dims(a)} vs ${dims(b)}` });
    }
  }
  return out;
}, [ENTERABLE, PASSABLE]);
const solid = await page.evaluate(() => window.__ct.colliders()
  .filter((q) => Math.abs(q.minX) < 400 && Math.abs(q.minZ) < 400).length);
console.log('  (moving boxes — the six citizens — are excluded; a person beside a car is not a trap)');
traps.sort((p, q) => p.w - q.w);

console.log(`gap probe: ${solid} solid boxes, ${traps.length} in the trap band ` +
  `(${ENTERABLE}–${PASSABLE} m)`);
// The interior belt is parked out at x > 100 and is somebody else's furniture;
// report it separately so the street's own traps are not buried in it.
const street = traps.filter((t) => t.x < 100);
const inside = traps.length - street.length;
for (const t of (showAll ? traps : street).slice(0, 25)) {
  console.log(`  ${t.w.toFixed(2)} m slot on ${t.axis} at (${t.x}, ${t.z})   boxes ${t.pair}`);
}
if (!showAll && inside) console.log(`  …and ${inside} more inside the interiors (x > 100) — pass --all`);
// ── the check that is MINE to keep green ─────────────────────────────────
//
// Most of the corridors above are between boxes I do not own — a building
// against a kerb prop, furniture inside a room. Reporting them is useful and
// reaching into someone else's module is not. What ct/gap.ts constrains is the
// PARKED ARRANGEMENT, so that is what gets asserted: no trap-band corridor may
// involve a vehicle-sized box. A car is about 2.1 x 4-5 m either way round.
const carish = (d) => {
  const [a, b] = d.split('x').map(Number);
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return lo > 1.8 && lo < 2.4 && hi > 3.5 && hi < 5.5;
};
const carTraps = street.filter((t) => t.pair.split(' vs ').some(carish));
console.log(`\n  ${street.length} trap-band corridor(s) on the street, ` +
  `${carTraps.length} of them involving a parked vehicle`);
for (const t of carTraps) console.log(`  FAIL ${t.w.toFixed(2)} m at (${t.x}, ${t.z})  ${t.pair}`);
console.log(carTraps.length === 0
  ? 'OK   no parked vehicle leaves a gap the player can enter but not leave'
  : `FAIL ${carTraps.length} parked vehicle gap(s) in the trap band`);
// ── and the other way a parked car ruins a doorway ────────────────────────
//
// A trap-band corridor is not the only harm a badly drawn parking spot does.
// GOTCHAS §8: a collider sitting on an [E] spot EATS the trigger — the prompt
// never appears and the player never learns why. That is invisible to the gap
// arithmetic above, because the car is not making a narrow corridor with
// anything; it is simply standing on the doorbell.
//
// Same ownership line as the check above: I assert only VEHICLE-sized boxes,
// because those are what ct/gap.ts and the parking draw constrain. A building
// or a bin over a doorway is real and worth printing, but it belongs to the
// module that put it there, so it is reported and not failed on.
const doorbells = await page.evaluate(() => {
  const RAD = 0.36;                                  // the player capsule
  const spots = window.__ct.spots().map((sp) => ({ label: sp.label, x: sp.x, z: sp.z, r: sp.r }));
  const boxes = window.__ct.colliders().map((c) => ({
    minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ,
    w: c.maxX - c.minX, d: c.maxZ - c.minZ,
  }));
  const hits = (b, px, pz) => px > b.minX - RAD && px < b.maxX + RAD && pz > b.minZ - RAD && pz < b.maxZ + RAD;

  // "IS THE SPOT INSIDE A BOX" IS THE WRONG QUESTION, and asking it printed a
  // screenful of things that are not faults: a shop's [E] spot sits ON its own
  // building's face, so it is inside that building's AABB by construction, and
  // an interior door spot is inside the room's own wall. Every one of those
  // works fine, because the player stands just outside the wall and is still
  // within the trigger radius.
  //
  // The trigger is eaten when there is NOWHERE within reach that the player can
  // actually stand. So ask that instead: sample the disc around the spot and see
  // whether any of it is free of every collider.
  const out = [];
  for (const sp of spots) {
    let free = false;
    const blockers = new Set();
    for (let i = 0; i < 16 && !free; i++) {
      const a = (i / 16) * Math.PI * 2;
      for (const f of [0.85, 0.55, 0]) {
        const px = sp.x + Math.cos(a) * sp.r * f, pz = sp.z + Math.sin(a) * sp.r * f;
        const b = boxes.find((bb) => hits(bb, px, pz));
        if (!b) { free = true; break; }
        blockers.add(b);
      }
    }
    if (free) continue;
    const list = [...blockers];
    const veh = list.filter((b) => {
      const lo = Math.min(b.w, b.d), hi = Math.max(b.w, b.d);
      return lo > 1.8 && lo < 2.4 && hi > 3.5 && hi < 5.5;
    });
    out.push({ label: sp.label, x: +sp.x.toFixed(2), z: +sp.z.toFixed(2), r: sp.r,
      boxes: list.length, vehicle: veh.length > 0,
      size: (veh[0] ?? list[0]) ? `${(veh[0] ?? list[0]).w.toFixed(1)}x${(veh[0] ?? list[0]).d.toFixed(1)}` : '?' });
  }
  return { spots: spots.length, out };
});

// A FILTER THAT FINDS NOTHING MUST NOT PASS. The [E] census counts ~135 spots,
// so a handful means the affordance changed shape and this check is measuring
// air — which is worth an exit code of its own, not a green tick.
if (doorbells.spots < 50) {
  console.error(`\nINCONCLUSIVE — __ct.spots() returned only ${doorbells.spots} spots. ` +
    'The [E] census counts about 135, so this is measuring air, not a clean world.');
  await browser.close();
  process.exit(2);
}
// Same ownership line as the corridor check above: assert only what the parking
// draw constrains. A building or a bin over a doorway is real and printed, but
// it belongs to the module that put it there.
const eaten = doorbells.out.filter((d) => d.vehicle);
const foreign = doorbells.out.filter((d) => !d.vehicle);
console.log(`\n  ${doorbells.spots} [E] spots checked for somewhere to stand`);
// ONE LINE, NOT SIXTY-TWO. Most of these are inside a collider ON PURPOSE and
// I cannot tell which from outside: `ctx.seat()` registers a "stand up" spot
// that only fires WHILE the player is sitting on the bench, so it is inside
// that bench's box by design; an interior door spot sits in its own room's
// wall. Printing each one as a finding would make this probe something people
// learn to skip, which is worse than not having it. The count is enough for
// whoever owns them to ask the question.
if (foreign.length) console.log(`  ..   ${foreign.length} spot(s) have nowhere standable within reach and no vehicle involved`
  + ' — seats ("stand up" fires while sitting) and interior doorways are expected here; not this probe\'s business');
for (const d of eaten) console.log(`  FAIL "${d.label}" at (${d.x}, ${d.z}) is under a ${d.size} m VEHICLE — the prompt silently never appears`);
console.log(eaten.length === 0
  ? `OK   no parked vehicle stands on an [E] spot${foreign.length ? ` (${foreign.length} unreachable for other modules' reasons)` : ''}`
  : `FAIL ${eaten.length} [E] spot(s) eaten by a parked vehicle`);

if (errs.length) console.log(`\npage errors:\n${errs.slice(0, 3).join('\n')}`);
await browser.close();
process.exitCode = (carTraps.length === 0 && eaten.length === 0) ? 0 : 1;
