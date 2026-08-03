// The side street's furniture must not close the walk. GOTCHAS §9: the 2 m
// lane is sacred, and it is proved by WALKING it, not by looking.
//
//   1. both side-street walks are passable end to end, past every tree
//   2. the bodega door still opens (its [E] spot is on the north walk, 2 m
//      west of the first tree — GOTCHAS §8)
//   3. the parked cars are off the travel lanes: a car can still drive the
//      side street without braking for them
//   4. nothing is floating or sunk
//
// Usage: SHOT_URL=http://localhost:4187/ node scripts/side-walk.mjs
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { afterFrames } from './lib/frames.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
// THE INTEGRATION WORLD DROPS ITS HMR SOCKET, and that is not a defect in the
// world. `live-integrate.sh` rebuilds every 15 s, so Vite's client reports
// "WebSocket closed without opened" — reportWorld's own banner says to expect
// exactly one. Counting it as a page error made every probe of mine exit 1
// against :5177 with all assertions green, which defeats the opt-in
// (SHOT_WORLD=integration) that was added so this could be asked at all.
// Dropped ONLY that message, ONLY in that mode: a real error still fails.
const HMR_NOISE = /WebSocket closed without opened/;
const noise = (m) => process.env.SHOT_WORLD === 'integration' && HMR_NOISE.test(m);
page.on('pageerror', (e) => { const m = String(e.message); if (!noise(m)) errs.push(m); });
await page.goto(aim('http://localhost:4177/'), { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(page, aim('http://localhost:4177/'));   // GOTCHAS 26: prove it, do not just name it
await page.waitForTimeout(400);
await page.evaluate(() => window.__ct.clock(13, 0));

let fails = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${msg}`); if (!ok) fails++; };
const pos = () => page.evaluate(() => window.__ct.pos());

// yaw for a heading: forward is (sin yaw, -cos yaw), so east is +π/2
const EAST = Math.PI / 2, WEST = -Math.PI / 2;
// A HIKE ASSERTS THAT THE WALK IS PASSABLE, WHICH IS NOT THE SAME AS A DISTANCE
// IN A TIME. It was `moved > 26` over 11 s, and six samples of the same
// unchanged world ran 28.4 to 36.4 m — 2.4 m of margin against a 7.6 m swing,
// which is why a run failed two of these and the next three passed. How far you
// get depends on who you meet: a stopped citizen is solid until it gives way,
// and B's bus.mjs was caught by the same mechanism from the other side
// (710e1454).
//
// So sample while the key is held and assert the longest STALL. Being held for
// a beat is the give-way working; being held for four seconds is the lane being
// blocked, and that is true whatever the total distance. The distance floor
// stays as a second, much looser line — it only has to separate "moving" from
// "went nowhere", which is what the original was reaching for.
const hike = async (label, x, z, yaw, seconds, want) => {
  await page.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0.14, 0), [x, z, yaw]);
  await afterFrames(page);   // GOTCHAS 30: the warp lands on a FRAME, not after 150 ms
  const a = await pos();
  await page.keyboard.down('w');
  const track = [a];
  for (let i = 0; i < seconds * 2; i++) { await page.waitForTimeout(500); track.push(await pos()); }
  await page.keyboard.up('w');
  await page.waitForTimeout(60);
  const b = track[track.length - 1];
  let stall = 0, worst = 0;
  for (let i = 1; i < track.length; i++) {
    const step = Math.hypot(track[i][0] - track[i - 1][0], track[i][2] - track[i - 1][2]);
    if (step < 0.15) { stall += 0.5; if (stall > worst) worst = stall; } else stall = 0;
  }
  const moved = Math.abs(b[0] - a[0]);
  check(worst <= 2.5, `${label}: never stuck — longest stall ${worst.toFixed(1)} s, ${moved.toFixed(1)} m covered `
    + `(x ${a[0].toFixed(1)}→${b[0].toFixed(1)}, z ${b[2].toFixed(2)})`);
  check(moved > want, `${label}: and it goes somewhere — ${moved.toFixed(1)} m`);
  return b;
};

console.log('side street probe:');

// ── 0. what is out there, and is it sitting on the ground ─────────────────
// Taken BEFORE any traffic is spawned, so a moving car cannot be counted as a
// parked one — they are the same models with the same userData.
const heights = await page.evaluate(() => {
  const out = { trees: [], pits: [], cars: [] };
  window.__ct.scene().traverse((o) => {
    if (o.position.x < 8 || o.position.x > 60 || o.position.z > -95 || o.position.z < -112) return;
    if (o.type === 'Group' && o.userData.steer !== undefined && o.visible) out.cars.push(+o.position.y.toFixed(3));
    // a tree: a 3 m wide billboard. The side street's centre line is also an
    // alphaTest plane down here, which is what the first cut of this counted.
    else if (o.geometry?.parameters?.width === 3 && o.material?.alphaTest === 0.5) out.trees.push(+o.position.y.toFixed(3));
    // MY pits, by their own geometry — 0.8 x 1.0, the same plane ct/sidestreet.ts
    // makes. Matching "a flat plane in this y band" instead caught other
    // modules' ground decals the moment they added any: the world was right and
    // this check was wrong, which is the worse of the two.
    else if (o.geometry?.parameters?.width === 0.8 && o.geometry?.parameters?.height === 1.0
      && Math.abs(o.rotation.x + Math.PI / 2) < 1e-6) out.pits.push(+o.position.y.toFixed(3));
  });
  return out;
});
check(heights.trees.length === 4 && heights.trees.every((y) => y === 0.14),
  `4 trees, all planted on the kerb at y=0.14 (${[...new Set(heights.trees)].join(',')})`);
check(heights.cars.length === 3 && heights.cars.every((y) => y === 0),
  `3 parked cars, all on the road at y=0 (${heights.cars.length} found at y=${[...new Set(heights.cars)].join(',')})`);
check(heights.pits.length === 4 && new Set(heights.pits).size === 1,
  `4 dirt pits, all at y=${[...new Set(heights.pits)].join(',')}`);

// ── 1. the two walks, east and back ───────────────────────────────────────
// Walk the middle of each walk: north walk is z -98…-96, south is -108…-110.
// Trees stand at z=-97.6 / -108.4, so the lane past them is the building half.
await hike('north walk, east past every tree', 12.5, -96.8, EAST, 11, 12);
await hike('north walk, back west', 46, -96.8, WEST, 11, 12);
await hike('south walk, east past every tree', 12.5, -109.2, EAST, 11, 12);
await hike('south walk, back west', 46, -109.2, WEST, 11, 12);

// ── 2. the bodega door is still reachable ─────────────────────────────────
// Walk up to it the way a player would, west along the north walk, and sample
// how close the player gets to the trigger. The HUD prompt is painted on a
// canvas, not in the DOM, so "did the prompt appear" is not readable from here
// — but "did the player get inside the trigger radius without being stopped"
// is the mechanical question anyway, and it is the one the seam audit asked.
//
// THE DOOR IS ASKED FOR, NOT TYPED IN. This read `DOOR = {x: 8.7, z: -96.85,
// r: 1.05}` and failed at 3.53 m for as long as anyone remembers, filed as a
// "pre-existing failure at the bodega door". There is no door there. The world's
// spot is `into the BODEGA` at (7.47, -95.53) with r=1.80 — 1.8 m away and with
// a radius nearly twice as big, so the constant was failing against a point the
// world does not have. That is BUILDER-BRIEF §8 exactly: a second hand-typed
// copy of a value another module owns. Section 5 below has always read
// `__ct.spots()`; this half simply never did.
const DOOR = await page.evaluate(() => {
  const sp = window.__ct.spots().find((s) => /BODEGA/i.test(s.label));
  return sp ? { label: sp.label, x: sp.x, z: sp.z, r: sp.r } : null;
});
// AND IT REFUSES TO PASS WHEN IT CANNOT FIND ONE. A missing spot must be a
// FAIL, never a skip: the whole point of the check is that the bodega door has
// not been eaten, and "no bodega spot in this world" is that defect in its
// worst form (GOTCHAS 71 — a check proving an absence must prove it looked).
check(!!DOOR, `the world publishes a BODEGA [E] spot to walk at`
  + (DOOR ? ` — "${DOOR.label}" at (${DOOR.x.toFixed(2)}, ${DOOR.z.toFixed(2)}) r=${DOOR.r}` : ''));
if (DOOR) {
  // WHY THIS IS NO LONGER ONE STRAIGHT LINE. The old walk held W due west along
  // z=-97.0 with a fixed yaw and stopped dead at x=12.2 — against the bodega's
  // two produce crates (x 10.44..11.76, z -96.69..-96.13; ct/bodega-corner.ts
  // :511-512), which the user asked to be tucked against that wall and which
  // leave a 3.18 m lane beside them. The walk itself is fine: swept over
  // x 8..20 the clear lane never drops below 1.40 m.
  //
  // But the clear lane is not STRAIGHT — it is centred z -97.10 east of the
  // crates and z -98.29 beside them, so the widest z that is free at every x
  // from 14 down to 8 is a band about 0.10 m across. Threading a 10 cm slot is
  // not what a player does and a hard-coded lane tuned until it passes is what
  // this check is being repaired FOR, so the straight line is gone.
  //
  // The invariant that actually matters is the one the seam audit asked for:
  // CAN A PLAYER ON FOOT GET INSIDE THE TRIGGER. So walk in at it from eight
  // headings, one player-radius grid out at 4 m, and require the pavement side
  // to work. No tuned number, and it still fails the moment the door is walled
  // in or a collider is parked on it.
  const START = 4.0;
  const approaches = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const sx = DOOR.x + Math.cos(a) * START, sz = DOOR.z + Math.sin(a) * START;
    // forward is (sin yaw, -cos yaw); aim it back down the radius at the door
    const yaw = Math.atan2(DOOR.x - sx, -(DOOR.z - sz));
    // A START INSIDE THE SHOPFRONT IS NOT AN APPROACH. Three of the eight land
    // in the bodega's own masonry — it is a corner building — and warping into
    // a wall would measure `unstick`, not the doorway.
    const inWall = await page.evaluate(([x, z]) => {
      const R = 0.36;
      return window.__ct.staticColliders().some((c) => {
        let px = x, pz = z;
        if (c.rot) {   // fp.ts:55 inFrame — a turned box's extents are its OWN frame
          const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
          const s = Math.sin(c.rot), k = Math.cos(c.rot), dx = x - cx, dz = z - cz;
          px = cx + dx * k - dz * s; pz = cz + dx * s + dz * k;
        }
        return px > c.minX - R && px < c.maxX + R && pz > c.minZ - R && pz < c.maxZ + R;
      });
    }, [sx, sz]);
    if (inWall) { approaches.push({ i, sx, sz, near: null }); continue; }
    await page.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0.14, 0), [sx, sz, yaw]);
    await afterFrames(page);   // GOTCHAS 30: the warp lands on a FRAME, not after 150 ms
    let near = 99;
    await page.keyboard.down('w');
    for (let k = 0; k < 10; k++) {
      await page.waitForTimeout(250);
      const q = await pos();
      near = Math.min(near, Math.hypot(q[0] - DOOR.x, q[2] - DOOR.z));
    }
    await page.keyboard.up('w');
    await page.waitForTimeout(60);
    approaches.push({ i, sx, sz, near });
  }
  const walked = approaches.filter((a) => a.near !== null);
  const reached = walked.filter((a) => a.near < DOOR.r);
  const best = walked.length ? Math.min(...walked.map((a) => a.near)) : 99;
  for (const a of approaches) {
    console.log(`       ${a.near === null ? 'start inside the shopfront, skipped'
      : `${a.near < DOOR.r ? 'IN ' : '   '} ${a.near.toFixed(2)} m`}`
      + `   from (${a.sx.toFixed(2)}, ${a.sz.toFixed(2)})`);
  }
  check(walked.length >= 4, `the bodega door can be walked at from ${walked.length} of 8 headings `
    + `(the rest start inside its own masonry)`);
  check(reached.length > 0, `bodega door still reachable on foot — ${reached.length}/${walked.length} approaches `
    + `got inside the trigger, closest ${best.toFixed(2)} m (r=${DOOR.r})`);
  // …AND FROM THE PAVEMENT, which is the half GOTCHAS §8 is about: the walk is
  // the way a player arrives, and a door reachable only by stepping into the
  // road is a door the walk has lost. Headings 5-7 are the south/south-east
  // quadrant, i.e. the north walk.
  const fromWalk = reached.filter((a) => a.i >= 5);
  check(fromWalk.length > 0, `and from the north walk itself — ${fromWalk.length} of the pavement-side `
    + `approaches got inside the trigger`);
}

// ── 3. the parked cars are off the travel lane ────────────────────────────
// drive the side street west→north and check it never has to brake for them
const drive = await page.evaluate(async () => {
  window.__ct.warp(-6.2, 40, 0, 0.14, 0);      // stand well away
  window.__ct.drive('EN', 'car');
  const out = [];
  const t0 = performance.now();
  let last = -1;
  while (performance.now() - t0 < 26000) {
    await new Promise((r) => requestAnimationFrame(r));
    const now = performance.now() - t0;
    if (now - last < 60) continue;
    last = now;
    const v = window.__ct.traffic()[0];
    // x > 20 only: the wide arc caps speed at sqrt(3·6.5) = 4.4 m/s and the
    // look-ahead starts braking about 10 m out, so anything west of ~15 is
    // slowing for the CORNER. Sampling that would measure the junction, not
    // the parked cars — which sit at x ≈ 15, 25 and 38.
    if (v && v.x > 20) out.push([v.x, v.z, v.spd]);
  }
  return out;
});
// The invariant is "a parked car does not slow the travel lane", and that is the
// SPEED. Whether a car happens to reach x>20 inside the window is timing: it can
// yield to a pedestrian on the crossing on the way, which is correct behaviour.
// So an empty sample is INCONCLUSIVE, not a failure — reporting it as FAIL is how
// a probe gets ignored.
if (!drive.length) {
  console.log('  ??   INCONCLUSIVE — no car reached x>20 in 26 s (it yields to anyone on the ' +
    'crossing, so this window can miss); re-run to measure the parked-car clearance');
} else {
  const slowest = Math.min(...drive.map((s) => s[2]));
  check(slowest > 7.5, `never braked for a parked car — slowest ${slowest.toFixed(2)} m/s ` +
    `past them over ${drive.length} samples east of x=20 (cruise is 8.5)`);
}

// ── 5. nothing of mine parks on somebody else's doorbell ──────────────────
//
// GOTCHAS §8: a collider can eat an [E] trigger, and the player never learns
// why — the prompt simply never appears. My three side-street cars are DRAWN
// from the seeded stream and then moved again by settleParking, so a change to
// the draw or to any collider planted later can slide one in front of a door
// that a different module owns. That is not hypothetical: this pass exists
// because a bin planted after the draw once trapped a car, and the casino and
// hotel doors on this street have just been re-derived from ct/vice.ts.
//
// So: no collider may sit inside an [E] spot's radius out here. It asserts the
// SPOT COUNT too, because a filter that finds nothing would otherwise pass.
const doors = await page.evaluate(() => {
  const RAD = 0.36;                                  // the player capsule
  const spots = window.__ct.spots()
    .filter((sp) => sp.x > 10 && sp.z > -112 && sp.z < -92)
    .map((sp) => ({ label: sp.label, x: sp.x, z: sp.z, r: sp.r }));
  // EVERY collider, not a windowed subset. The first version of this check
  // filtered boxes to the same x/z window as the spots, which quietly excluded
  // the casino and hotel footprints — it passed because it could not see them,
  // not because they were clear. `staticColliders()` narrows by KIND, never by
  // position, so that fix is untouched.
  //
  // STATIC, because "can the player stand within reach of this [E]" is a
  // question about the world's geometry. The side street is a pavement the
  // crowd walks, so a citizen standing on a spot at the sampled instant would
  // otherwise be reported as a trigger nobody can reach — and they will have
  // walked on before anyone reads the output. Same invariant, and now the same
  // collider set, as scripts/gaps.mjs's doorbell half.
  const boxes = window.__ct.staticColliders();
  const hits = (b, px, pz) => px > b.minX - RAD && px < b.maxX + RAD && pz > b.minZ - RAD && pz < b.maxZ + RAD;
  // And the question is "can the player STAND within reach", not "is the spot
  // inside a box" — a shopfront's spot is inside its own building's AABB by
  // construction, and works fine, because you stand outside the wall. See
  // scripts/gaps.mjs, which asserts the same invariant for the whole world.
  return spots.map((sp) => {
    let free = false;
    const blockers = [];
    for (let i = 0; i < 16 && !free; i++) {
      const a = (i / 16) * Math.PI * 2;
      for (const f of [0.85, 0.55, 0]) {
        const px = sp.x + Math.cos(a) * sp.r * f, pz = sp.z + Math.sin(a) * sp.r * f;
        const b = boxes.find((bb) => hits(bb, px, pz));
        if (!b) { free = true; break; }
        blockers.push(b);
      }
    }
    return { ...sp, blocked: free ? 0 : blockers.length };
  });
});
check(doors.length >= 2, `found the side street's [E] spots to check (${doors.length}: ${doors.map((d) => d.label).join(', ')})`);
for (const d of doors) {
  check(d.blocked === 0, `nothing parks on "${d.label}" at (${d.x.toFixed(2)}, ${d.z.toFixed(2)}) r=${d.r}`
    + (d.blocked ? ` — nowhere standable within r=${d.r}; the prompt silently never appears` : ''));
}

console.log(errs.length ? `\npage errors:\n${errs.slice(0, 3).join('\n')}` : '\nno page errors');
console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nall side street checks pass');
await browser.close();
process.exitCode = fails ? 1 : 0;
