// Item 249 (1) — LOOK AT THE CHAIR. The row says "look at the frame" and it is
// right to: item 146's whole lesson is that the numbers said the chair was fine
// and the picture said otherwise.
//
// Stands the rig in front of the chair in 301 and shoots it from two heights —
// eye level, and crouched to the seat, where an embedded garment is visible and
// from standing it is not.
//
//   SHOT_URL=http://localhost:4750/ TAG=before node scripts/probes/w119-249-chair-shot.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4750/');
const TAG = process.env.TAG ?? 'now';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await waitPainted(p);
await p.waitForTimeout(500);

// The chair, asked for rather than typed: the seat pan is the only
// 0.42 x 0.04 x 0.40 box in the room (BUILDER-BRIEF §8).
const seat = await p.evaluate(() => {
  let hit = null;
  window.__ct.scene().traverse((o) => {
    const g = o.geometry && o.geometry.parameters;
    if (!g || g.width === undefined) return;
    if (Math.abs(g.width - 0.42) > 1e-4 || Math.abs(g.height - 0.04) > 1e-4
      || Math.abs(g.depth - 0.40) > 1e-4) return;
    o.updateWorldMatrix(true, false);
    hit = { x: o.position.x, y: o.position.y, z: o.position.z };
  });
  return hit;
});
console.log('seat pan at', seat);

// No `gy` is passed: the player already SPAWNS inside 301 (GOTCHAS 51), so the
// storey is already right and a guessed floor height would only break it.
// THE THIRD VIEW IS THE ONE THAT ANSWERS THE QUESTION. Head-on, the garment
// covers the pan and "resting on it" and "sunk into it" look nearly the same;
// from the front quarter and high, the pan's own top face is visible beside the
// garment and the join can actually be read.
const VIEWS = [['eye', 1.10, 0, -0.32], ['low', 0.80, 0, -0.60], ['quarter', 0.85, -0.75, -0.78]];
for (const [name, dz, dx, pitch] of VIEWS) {
  await p.evaluate(([sx, sz, dz, dx, pitch]) => {
    // Stand back from the chair on -z and look at it. THE YAW CONVENTION IS
    // MEASURED, not guessed — `probes/w119-249-aim.mjs` drove all four cardinals
    // and found `dir = (sin yaw, -cos yaw)`, so facing a delta (dx, dz) is
    // `atan2(dx, -dz)`. The first cut of this probe used `atan2(dx, dz)` and
    // photographed the opposite wall.
    window.__ct.warp(sx + dx, sz - dz, Math.atan2(-dx, -dz), undefined, pitch);
  }, [seat.x, seat.z, dz, dx, pitch]);
  await p.waitForTimeout(600);
  const path = `shots/w119-249-chair-${TAG}-${name}.png`;
  await p.screenshot({ path });
  console.log('->', path);
}
await b.close();
