// Item 82 acceptance: the (8.50, -94.50) phantom, both predicates, same world.
//
// WHY NOT JUST RUN unstick-walk AND LOOK AT THE EXIT CODE. Because it is green
// both before and after the fix, and that green is worth nothing here — see
// BUILDER-BRIEF's "a red without a green is half a measurement". The phantom is
// a RACE, and the losing side of it is the one that reports the bug:
//
//   `unstick` pushes at 3 m/s and needs 1.067 m to clear the chamfer, so ~0.36 s
//   of dt. `unstick`'s PATIENCE is 0.45 s of dt, after which it gives up and
//   teleports the player to `lastGood` — hundreds of metres away, where every
//   predicate agrees he is free.
//
//   At 60 fps (dt = 1/60) the push wins: the player comes to rest at
//   (7.745, -95.255), genuinely free, and the rotation-blind predicate calls
//   him buried — THE PHANTOM FIRES.
//   Under load (dt clamped at 0.05 s, src/main.ts) PATIENCE wins first: the
//   player is flung to `lastGood` and the same predicate says "freed itself" —
//   the phantom is masked, and the whole suite passes.
//
// A full 531-trap run is exactly the loaded case, which is why the bug hid in a
// green suite. So this asks the one question directly, N times, with both
// predicates against the same frames.
//
// Usage: SHOT_URL=http://localhost:4180/ node scripts/probes/w39-phantom-repro.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { installCollide } from '../lib/collide.mjs';
import { reportWorld } from '../lib/which-world.mjs';

const RADIUS = 0.36;
const TX = 8.5, TZ = -94.5;
const ROUNDS = +(process.env.ROUNDS ?? 8);
const URL = aim('http://localhost:4180/');

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.colliders !== undefined, { timeout: 15000 });
await reportWorld(p, URL);
await installCollide(p);
await p.waitForTimeout(300);

// ── the collider under the target ─────────────────────────────────────────
const box = await p.evaluate(([TX, TZ]) => {
  for (const c of window.__ct.colliders()) {
    if (Math.abs((c.minX + c.maxX) / 2 - TX) < 0.01 && Math.abs((c.minZ + c.maxZ) / 2 - TZ) < 0.01) {
      return { minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ, rot: c.rot ?? 0,
        world: window.__probeCollide.worldAabb(c) };
    }
  }
  return null;
}, [TX, TZ]);
if (!box) { console.log('NO COLLIDER CENTRED ON THE TARGET — the premise has moved; stop and re-measure.'); await b.close(); process.exit(3); }
console.log(`the collider centred on ${TX},${TZ}:`);
console.log(`   own frame  x ${box.minX.toFixed(3)}..${box.maxX.toFixed(3)}  z ${box.minZ.toFixed(3)}..${box.maxZ.toFixed(3)}  rot ${box.rot.toFixed(4)}`);
console.log(`   world AABB x ${box.world.minX.toFixed(3)}..${box.world.maxX.toFixed(3)}  z ${box.world.minZ.toFixed(3)}..${box.world.maxZ.toFixed(3)}`);
if (!box.rot) { console.log('   rot is 0 — there is no turned box here and nothing to test.'); await b.close(); process.exit(3); }
console.log('   the target is its CENTRE: the middle of solid masonry.\n');

// GOTCHAS 71: prove this looked at something. A run where the frame-aware
// predicate never disagrees with the raw one anywhere would pass vacuously.
const rotated = await p.evaluate(() => window.__ct.colliders().filter((c) => c.rot).length);
console.log(`turned colliders in the world: ${rotated}\n`);

/** `probeTrap` from scripts/unstick-walk.mjs, with the predicate swapped in.
 *  `framed:false` is the code as it stood before item 82; `framed:true` is the
 *  code as it stands now. Everything else is identical, deliberately. */
const probeTrap = (x, z, framed) => p.evaluate(([x, z, R, framed, stillNeed, budget]) => new Promise((resolve) => {
  const raw = (px, pz) => window.__ct.colliders().some((c) =>
    px > c.minX - R && px < c.maxX + R && pz > c.minZ - R && pz < c.maxZ + R);
  const blockedAt = framed
    ? (px, pz) => window.__probeCollide.blockedAt(window.__ct.colliders(), px, pz, R)
    : raw;
  const anyWayOut = (px, pz) => {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      if (!blockedAt(px + Math.cos(a) * 0.25, pz + Math.sin(a) * 0.25)) return true;
    }
    return false;
  };
  window.__ct.warp(x, z, 0, 0, 0);
  let n = 0, still = 0, lx = null, lz = null;
  const done = (why) => {
    const [px, , pz] = window.__ct.pos();
    resolve({ why, frames: n, x: px, z: pz, blocked: blockedAt(px, pz), canMove: anyWayOut(px, pz) });
  };
  const tick = () => {
    const [px, , pz] = window.__ct.pos();
    if (n > 0 && !blockedAt(px, pz)) return done('free');
    if (lx !== null && Math.hypot(px - lx, pz - lz) < 1e-4) still++; else still = 0;
    lx = px; lz = pz;
    if (still >= stillNeed) return done('stalled');
    if (++n > budget) return done('budget');
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}), [x, z, RADIUS, framed, 40, 240]);

// unstick-walk's own verdict rule, in one place so both columns are scored the
// same way: a trap is a FAIL if the player is still inside, or came free with
// every direction blocked.
const fails = (r) => r.blocked || !r.canMove;

console.log(`── ${ROUNDS} rounds, warped into the middle of the wall, both predicates ──`);
const tally = { raw: 0, framed: 0 };
for (let i = 0; i < ROUNDS; i++) {
  const a = await probeTrap(TX, TZ, false);
  const c = await probeTrap(TX, TZ, true);
  if (fails(a)) tally.raw++;
  if (fails(c)) tally.framed++;
  console.log(`  ${String(i + 1).padStart(2)}  rotation-blind: ${fails(a) ? 'FAIL' : 'ok  '} (${a.why} @ ${a.x.toFixed(3)},${a.z.toFixed(3)} after ${a.frames}f)`
    + `   frame-aware: ${fails(c) ? 'FAIL' : 'ok  '} (${c.why} @ ${c.x.toFixed(3)},${c.z.toFixed(3)} after ${c.frames}f)`);
}
console.log(`\n  rotation-blind (before item 82): ${tally.raw}/${ROUNDS} report a trap`);
console.log(`  frame-aware    (after  item 82): ${tally.framed}/${ROUNDS} report a trap`);

const ok = tally.raw > 0 && tally.framed === 0;
console.log(ok
  ? '\n  => THE PHANTOM IS GONE, and the run that proves it also proves it was there.'
  : tally.raw === 0
    ? '\n  => INCONCLUSIVE: the old predicate did not fire either. Every round lost the\n'
      + '     PATIENCE race and was teleported to lastGood. Re-run; if it never fires,\n'
      + '     the machine is too loaded to reproduce and this proves nothing.'
    : '\n  => STILL FAILING: the frame-aware predicate reports a trap here too.');
await b.close();
process.exit(ok ? 0 : 1);
