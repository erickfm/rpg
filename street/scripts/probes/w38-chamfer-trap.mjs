// w38 — ITEM 79. Is (8.50, -94.50) a trap a player can WALK into?
//
// unstick-walk reports `inside @ 8.50,-94.50 — still inside a collider after
// 1.1 s (at 7.75,-95.25)`, and the row calls it "a real trap the player can walk
// into". But unstick-walk WARPS to its test points (scripts/unstick-walk.mjs:85)
// — it teleports the rig into the position rather than walking there. So that
// output is a statement about how `unstick` behaves once you are ALREADY inside
// masonry, not about anything reachable.
//
// (8.50, -94.50) is the exact CENTRE of the bodega chamfer collider — a solid
// rotated box, half-extents 1.414 x 0.707 about that very point. Walking into
// the middle of a wall is not something collision permits, so this asks the
// question the row asks for, and asks it the way the row demands: BY WALKING.
//
//   1. can the player reach it on foot, from any of 16 headings?
//   2. warped in on purpose, does unstick get him out?
//
//   SHOT_URL=http://localhost:<port>/ node scripts/probes/w38-chamfer-trap.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const TX = 8.50, TZ = -94.50;
const URL = aim();
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const pos = () => p.evaluate(() => window.__ct.pos());
const warp = (x, z, yaw) => p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0), [x, z, yaw]);

// The box itself, straight from the live collider array.
const box = await p.evaluate(([tx, tz]) => {
  const c = window.__ct.colliders().find((k) => k.rot
    && Math.abs((k.minX + k.maxX) / 2 - tx) < 0.01 && Math.abs((k.minZ + k.maxZ) / 2 - tz) < 0.01);
  return c ? { minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ, rot: c.rot } : null;
}, [TX, TZ]);
console.log(`the collider centred on the target: ${JSON.stringify(box)}`);
if (box) {
  console.log(`  half-extents ${((box.maxX - box.minX) / 2).toFixed(3)} x ${((box.maxZ - box.minZ) / 2).toFixed(3)}` +
    `  rot ${box.rot.toFixed(4)} — the target is its CENTRE, i.e. the middle of solid masonry`);
}

// ── 1. CAN YOU WALK THERE? ────────────────────────────────────────────────
// Start 3 m out on 16 headings and walk straight at the target. Record the
// closest approach. If collision is sound nobody gets within the player radius.
console.log('\n── 1. walking at it from 16 headings, 3 m out ──');
let best = Infinity, bestAt = '';
for (let i = 0; i < 16; i++) {
  const th = (i * Math.PI * 2) / 16;
  const sx = TX + 3 * Math.cos(th), sz = TZ + 3 * Math.sin(th);
  // face the target: fwd = (sin yaw, -cos yaw)
  const yaw = Math.atan2(TX - sx, -(TZ - sz));
  await warp(sx, sz, yaw);
  await p.waitForTimeout(150);
  await p.keyboard.down('w');
  const near = await p.evaluate(([tx, tz, budget]) => new Promise((resolve) => {
    let n = 0, min = Infinity;
    const tick = () => {
      const [x, , z] = window.__ct.pos();
      min = Math.min(min, Math.hypot(x - tx, z - tz));
      if (++n > budget) return resolve(min);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), [TX, TZ, 120]);
  await p.keyboard.up('w');
  if (near < best) { best = near; bestAt = `heading ${(th * 180 / Math.PI).toFixed(0)}deg`; }
  console.log(`   from ${sx.toFixed(2)},${sz.toFixed(2)}  closest approach ${near.toFixed(3)} m`);
}
console.log(`\n   CLOSEST OVER ALL 16: ${best.toFixed(3)} m (${bestAt})`);
console.log(best > 0.36
  ? '   -> the player CANNOT walk into it: every heading is stopped outside the player radius (0.36 m).'
  : '   -> REACHABLE ON FOOT. This is a real trap.');

// ── 2. warped in, does unstick get him out? ───────────────────────────────
console.log('\n── 2. warped into the middle of the wall on purpose ──');
await warp(TX, TZ, 0);
const track = await p.evaluate(([budget]) => new Promise((resolve) => {
  const out = []; let n = 0;
  const tick = () => {
    const [x, , z] = window.__ct.pos();
    out.push([+x.toFixed(3), +z.toFixed(3)]);
    if (++n > budget) return resolve(out);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}), [140]);
const [ex, ez] = track[track.length - 1];
console.log(`   start 8.500,-94.500 -> end ${ex},${ez}   moved ${Math.hypot(ex - TX, ez - TZ).toFixed(3)} m`);
const stillIn = await p.evaluate(([x, z]) => {
  // fp.ts's own predicate, reached the only way a probe can: ask whether the
  // rig gets shoved from there.
  const R = 0.36;
  const inFrame = (c, px, pz) => {
    if (!c.rot) return { x: px, z: pz };
    const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
    const s = Math.sin(c.rot), k = Math.cos(c.rot);
    const dx = px - cx, dz = pz - cz;
    return { x: cx + dx * k - dz * s, z: cz + dx * s + dz * k };
  };
  return window.__ct.colliders().some((c) => {
    const q = inFrame(c, x, z);
    return q.x > c.minX - R && q.x < c.maxX + R && q.z > c.minZ - R && q.z < c.maxZ + R;
  });
}, [ex, ez]);
console.log(`   still inside a collider at the end: ${stillIn ? 'YES — unstick did not free him' : 'no — he got out'}`);
const uniq = new Set(track.map((t) => t.join(','))).size;
console.log(`   distinct positions over ${track.length} frames: ${uniq} (1 = frozen)`);

// ── 3. THE TWO PREDICATES, SIDE BY SIDE ───────────────────────────────────
// unstick-walk.mjs:35 decides "still inside" like this:
//
//   x > c.minX - R && x < c.maxX + R && z > c.minZ - R && z < c.maxZ + R
//
// with NO `inFrame`. On a ROTATED collider, minX..maxX / minZ..maxZ are the
// box's extents in ITS OWN frame, so comparing a world point against them
// without turning it into that frame tests a completely different region —
// here, an axis-aligned 2.83 x 1.41 rectangle standing in for one turned 45
// degrees. fp.ts's own `blocked()` applies `inFrame` first (fp.ts:287).
//
// So this asks both, at the same point, over the same colliders.
console.log('\n── 3. unstick-walk\'s predicate vs fp.ts\'s own, at the end position ──');
const verdicts = await p.evaluate(([x, z, R]) => {
  const inFrame = (c, px, pz) => {
    if (!c.rot) return { x: px, z: pz };
    const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
    const s = Math.sin(c.rot), k = Math.cos(c.rot);
    const dx = px - cx, dz = pz - cz;
    return { x: cx + dx * k - dz * s, z: cz + dx * s + dz * k };
  };
  const raw = [], framed = [];
  for (const c of window.__ct.colliders()) {
    const tag = `${c.minX.toFixed(2)}..${c.maxX.toFixed(2)} x ${c.minZ.toFixed(2)}..${c.maxZ.toFixed(2)} rot=${(c.rot ?? 0).toFixed(4)}`;
    if (x > c.minX - R && x < c.maxX + R && z > c.minZ - R && z < c.maxZ + R) raw.push(tag);
    const q = inFrame(c, x, z);
    if (q.x > c.minX - R && q.x < c.maxX + R && q.z > c.minZ - R && q.z < c.maxZ + R) framed.push(tag);
  }
  return { raw, framed };
}, [ex, ez, 0.36]);
console.log(`   unstick-walk (no inFrame): ${verdicts.raw.length} collider(s) say INSIDE`);
for (const t of verdicts.raw) console.log(`      ${t}`);
console.log(`   fp.ts blocked() (inFrame): ${verdicts.framed.length} collider(s) say INSIDE`);
for (const t of verdicts.framed) console.log(`      ${t}`);
console.log(verdicts.raw.length && !verdicts.framed.length
  ? '\n   => THE DISAGREEMENT IS THE BUG, and it is in the INSTRUMENT: the player is\n'
    + '      genuinely free, and unstick-walk calls him trapped because it measures a\n'
    + '      turned collider as though it were axis-aligned.'
  : '\n   => the two predicates agree here.');
await b.close();
