// Get deliberately stuck, over and over, and prove you always get out.
//
// The user: *"im literally stuck here. i think we need some sort of stuck
// protection or something smarter around collision and blocking"* — wedged
// between two parked cars with no input that could help, because
// `FPRig.blocked()` only ever asks about the position you are moving TO. Once
// you are inside a collider every direction is refused as well.
//
// So this does not test the one gap in the screenshot. It finds EVERY narrow
// gap in the world — every pair of colliders closer together than the 0.72 m
// player — and tries to get stuck in all of them, plus dead centre inside
// every named trap the brief lists. The specific parked cars that caused this
// are builder H's to re-space; the point of the safety net is that the next
// trap, wherever it is, is survivable.
//
// Usage: SHOT_URL=http://localhost:4185/ node scripts/unstick-walk.mjs
import { chromium } from 'playwright';

const RADIUS = 0.36, PLAYER = RADIUS * 2;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4185/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.colliders !== undefined, { timeout: 15000 });
await p.waitForTimeout(300);

const pos = () => p.evaluate(() => window.__ct.pos());
const warp = (x, z, gy) => p.evaluate(([x, z, gy]) => window.__ct.warp(x, z, 0, gy, 0), [x, z, gy]);
const hold = async (k, ms) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); await p.waitForTimeout(60); };
const isBlocked = (x, z) => p.evaluate(([x, z, R]) => window.__ct.colliders().some((c) =>
  x > c.minX - R && x < c.maxX + R && z > c.minZ - R && z < c.maxZ + R), [x, z, RADIUS]);

// Every trap the world offers, found rather than listed.
const traps = await p.evaluate(([RADIUS, PLAYER]) => {
  const cols = window.__ct.colliders().filter((c) =>
    // the street and its interiors, not the giant boundary walls: a "gap"
    // between two 100 m walls is a street, not a trap
    (c.maxX - c.minX) < 8 && (c.maxZ - c.minZ) < 8);
  const out = [];
  // 1. dead centre inside each solid thing — the dumpster, a bench, a crate,
  //    a car. This is "a collider appeared on top of you".
  for (const c of cols) {
    out.push({ kind: 'inside', x: (c.minX + c.maxX) / 2, z: (c.minZ + c.maxZ) / 2 });
  }
  // 2. the midpoint of every gap too narrow for the player to occupy — the
  //    exact shape of the parked-car wedge in the screenshot
  for (let i = 0; i < cols.length; i++) {
    for (let j = i + 1; j < cols.length; j++) {
      const a = cols[i], d = cols[j];
      const overlapZ = a.minZ < d.maxZ && d.minZ < a.maxZ;
      const overlapX = a.minX < d.maxX && d.minX < a.maxX;
      if (overlapZ) {
        const gap = Math.max(d.minX - a.maxX, a.minX - d.maxX);
        if (gap > 0 && gap < PLAYER + 0.25) {
          const x = d.minX > a.maxX ? (a.maxX + d.minX) / 2 : (d.maxX + a.minX) / 2;
          const z = (Math.max(a.minZ, d.minZ) + Math.min(a.maxZ, d.maxZ)) / 2;
          out.push({ kind: `gap ${gap.toFixed(2)}m`, x, z });
        }
      }
      if (overlapX) {
        const gap = Math.max(d.minZ - a.maxZ, a.minZ - d.maxZ);
        if (gap > 0 && gap < PLAYER + 0.25) {
          const z = d.minZ > a.maxZ ? (a.maxZ + d.minZ) / 2 : (d.maxZ + a.minZ) / 2;
          const x = (Math.max(a.minX, d.minX) + Math.min(a.maxX, d.maxX)) / 2;
          out.push({ kind: `gap ${gap.toFixed(2)}m`, x, z });
        }
      }
    }
  }
  return out;
}, [RADIUS, PLAYER]);

console.log(`${traps.length} traps found (inside-a-collider + every sub-${(PLAYER + 0.25).toFixed(2)} m gap)\n`);

const fails = [];
let tested = 0, freedBy = { push: 0, alreadyOut: 0 };
for (const t of traps) {
  if (!(await isBlocked(t.x, t.z))) { freedBy.alreadyOut++; continue; }   // gap wide enough after all
  tested++;
  await warp(t.x, t.z, 0);
  await p.waitForTimeout(60);
  // let the rig resolve it — no input at all, which is the honest test: a
  // stuck player pressing nothing must still come free
  await p.waitForTimeout(1100);
  const out = await pos();
  if (await isBlocked(out[0], out[2])) {
    fails.push(`${t.kind} @ ${t.x.toFixed(2)},${t.z.toFixed(2)} — still inside a collider after 1.1 s `
      + `(at ${out[0].toFixed(2)},${out[2].toFixed(2)})`);
    continue;
  }
  // …and having come free, you are genuinely not trapped: there is SOME
  // direction you can move in. Asked of the collider predicate rather than by
  // driving the rig in a couple of arbitrary directions — the thrift's aisles
  // clear the player by 0.19 m a side on purpose, so "hold W and expect a
  // metre" fails rooms that are working exactly as designed. Eight directions,
  // a quarter metre, is the honest statement of "not stuck".
  const canMove = await p.evaluate(([x, z, R]) => {
    const cols = window.__ct.colliders();
    const free = (a, c) => !cols.some((k) =>
      a > k.minX - R && a < k.maxX + R && c > k.minZ - R && c < k.maxZ + R);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      if (free(x + Math.cos(a) * 0.25, z + Math.sin(a) * 0.25)) return true;
    }
    return false;
  }, [out[0], out[2], RADIUS]);
  if (!canMove) {
    fails.push(`${t.kind} @ ${t.x.toFixed(2)},${t.z.toFixed(2)} — came free but every direction is still blocked `
      + `(at ${out[0].toFixed(2)},${out[2].toFixed(2)})`);
    continue;
  }
  freedBy.push++;
}

// Cross-check: for a handful, actually DRIVE the rig away, so the cheap
// predicate above is never trusted on its own.
let driven = 0, drivenOk = 0;
for (const t of traps.slice(0, 6)) {
  if (!(await isBlocked(t.x, t.z))) continue;
  await warp(t.x, t.z, 0);
  await p.waitForTimeout(1100);
  const o = await pos();
  let best = 0;
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    await p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0, 0), [o[0], o[2], yaw]);
    await p.waitForTimeout(50);
    const a = await pos();
    await hold('w', 400);
    const c = await pos();
    best = Math.max(best, Math.hypot(c[0] - a[0], c[2] - a[2]));
  }
  driven++;
  if (best > 0.25) drivenOk++;
  else fails.push(`DRIVEN ${t.kind} @ ${t.x.toFixed(2)},${t.z.toFixed(2)} — rig could not walk away (${best.toFixed(2)} m)`);
}
console.log(`${driven} of them also driven for real: ${drivenOk} walked away under their own steam`);
console.log(`${tested} were genuinely stuck; ${freedBy.push} freed themselves`);
console.log(`${freedBy.alreadyOut} candidate gaps turned out to be passable already\n`);
for (const f of fails) console.log(`  FAIL  ${f}`);
console.log(fails.length
  ? `\n${fails.length}/${tested} traps are still traps`
  : `\nall ${tested} traps release the player`);
if (errs.length) console.log('\npage errors:\n  ' + errs.slice(0, 5).join('\n  '));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
