import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
await p.goto(aim('http://localhost:4186/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(400);

// discover the jail room's slab centre the same way interiors-walk does:
// enter via E from its own door landing (60.12, -100.8), then read pos()
const warp = (x, z, yaw, gy) => p.evaluate(([x, z, yaw, gy]) => window.__ct.warp(x, z, yaw, gy, 0), [x, z, yaw, gy]);
const pos = () => p.evaluate(() => window.__ct.pos());
await warp(60.25, -103, Math.PI, 0.14);
await p.waitForTimeout(150);
await p.keyboard.down('e'); await p.waitForTimeout(90); await p.keyboard.up('e'); await p.waitForTimeout(400);
const p0 = await pos();
console.log('entered at', p0);
const cx = p0[0];

// ⚠ THIS COMPARED BY ARRAY INDEX (item 209). It sampled the room into a flat
// array and asked whether `night[i].hex !== noon[i].hex` — which is only the
// same material twice while nothing enters, leaves or reorders inside the 8 m
// box between the two samples. `interiors-walk.mjs` had the identical line over
// the identical kind of sample and returned 109, 109, 110 and then 0 across
// four runs of unchanged source (item 192).
//
// Keyed by `material.uuid` now — what makes a material the same material — and
// judged only over the materials present in BOTH samples, with FOUR samples at
// each hour so anything animating under its own power is excluded rather than
// reported as a dimmed surface. This is a probe, not a registered check, but a
// probe that mispairs is a probe that sends somebody to fix a room that is fine.
const sample = () => p.evaluate((cx) => {
  const out = {};
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh) return;
    const wp = new o.position.constructor();
    o.getWorldPosition(wp);
    if (Math.abs(wp.x - cx) > 8 || Math.abs(wp.z) > 8) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (m && m.color && !m.transparent) {
        out[m.uuid] = {
          hex: m.color.getHex(),
          name: o.name || '(unnamed)',
          type: o.type,
          matType: m.type,
          wx: wp.x, wy: wp.y, wz: wp.z,
          uuid: m.uuid,
          userData: JSON.stringify(o.userData || {}),
          matUserData: JSON.stringify(m.userData || {}),
        };
      }
    }
  });
  return out;
}, cx);

/** four samples with the clock held at `h`; the set that never moved, and the set that did */
const steadyAt = async (h, settle) => {
  await p.evaluate((hh) => window.__ct.clock(hh, 0), h);
  await p.waitForTimeout(settle);
  const shots = [];
  for (let i = 0; i < 4; i++) { shots.push(await sample()); if (i < 3) await p.waitForTimeout(500); }
  const steady = {}, moved = new Set();
  for (const u of Object.keys(shots[0])) {
    if (shots.every((s) => s[u] && s[u].hex === shots[0][u].hex)) steady[u] = shots[0][u];
    else moved.add(u);
  }
  return { steady, moved };
};

const noon = await steadyAt(12, 500);
const night = await steadyAt(2, 900);

const judged = Object.keys(noon.steady).filter((u) => night.steady[u] !== undefined);
const animated = new Set([...noon.moved, ...night.moved]);
const seen = Object.keys(noon.steady).length + animated.size;
console.log(`noon ${Object.keys(noon.steady).length} steady distinct materials,`
  + ` night ${Object.keys(night.steady).length}, ${animated.size} self-animating,`
  + ` ${judged.length} judged`);
let dimmed = 0;
for (const u of judged) {
  if (night.steady[u].hex !== noon.steady[u].hex) {
    dimmed++;
    console.log('--- DIMMED', u, '---');
    console.log('  noon ', noon.steady[u]);
    console.log('  night', night.steady[u]);
  }
}
console.log('total dimmed', dimmed, 'of', judged.length);

// A POPULATION FLOOR (GOTCHAS §34, and the whole point of item 209): every step
// above — the intersection, the self-animating exclusion — is a way for the
// judged set to shrink to nothing, and `total dimmed 0 of 0` reads exactly like
// a room that is fine. "I measured nothing" must be a failure, and it is EXIT 3
// (GOTCHAS §32), not 1: nothing follows about the jail either way.
const floor = Math.max(8, Math.round(seen * 0.5));
if (judged.length < floor) {
  console.log(`\nNOTHING TO CHECK: judged ${judged.length} of the ${seen} materials sampled`
    + ` in the room, floor is ${floor} — exiting 3 (GOTCHAS 32), nothing follows about the jail`);
  await b.close();
  process.exit(3);
}
await b.close();
