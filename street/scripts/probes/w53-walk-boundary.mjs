// ITEM 141: WALK the region boundary, because a cull that switches at x 100 is
// only safe if nobody can stand where it switches and see both sides.
//
// BUILDER-BRIEF §10: "Movement, collision and floors: WALK them." Everything
// else about this change was proved by warping, and warping is exactly what
// cannot see this class of fault — a teleport crosses the boundary in one
// step, so it can never show the frame where half the world is missing.
//
// Two questions, both answered on foot:
//
//   1. FROM THE STREET, HOW FAR EAST CAN YOU GET? The player's bounds run
//      unbroken from `westBound()` to `interiorMaxX()` (crosstown.ts), so only
//      colliders stop anyone walking east out of the street and into the dead
//      ground in front of the parked interiors. If any heading gets past
//      x 100 on foot, the cull has a seam the player can stand in and this
//      probe says so.
//
//   2. WALKING OUT OF 301 AND BACK IN: does the exterior come back? The door
//      is a teleport, so the risk is not a seam but a STUCK STATE — the cull
//      failing to lift, leaving a black street. Sampled every step.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w53-walk-boundary.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4184/');
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 900, height: 560 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(13, 30));
await p.mouse.click(450, 280);
const hold = async (k, ms) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); };

// ── 1. how far east can you walk from the street? ────────────────────────
console.log('1. WALKING EAST FROM THE STREET — the cull flips at x 100\n');
let worstX = -Infinity, worstAt = '';
for (const z of [-60, -40, -20, -8, 0, 8, 12]) {
  // face east (+x): the rig's forward is (sin yaw, 0, -cos yaw), so yaw +PI/2
  await p.evaluate(([zz]) => window.__ct.warp(0, zz, Math.PI / 2, 0, 0), [z]);
  await p.waitForTimeout(250);
  for (let i = 0; i < 10; i++) await hold('w', 700);   // ~7 s of running at a wall
  const q = await p.evaluate(() => window.__ct.pos());
  const info = await p.evaluate(() => window.__ct.cullInfo());
  if (q[0] > worstX) { worstX = q[0]; worstAt = `z ${z}`; }
  console.log(`   from z ${String(z).padStart(4)}: reached x ${q[0].toFixed(2)}   cull hiding=${info.hiding}`);
}
console.log(`\n   furthest east on foot: x ${worstX.toFixed(2)} (${worstAt}) — boundary is 100`);
const seam = worstX >= 100;

// ── 2. out of 301 and back, sampling every step ──────────────────────────
console.log('\n2. WALKING OUT OF 301 AND BACK IN\n');
await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.evaluate(() => window.__ct.clock(13, 30));
await p.mouse.click(450, 280);

const sample = async (tag) => {
  const q = await p.evaluate(() => window.__ct.pos());
  const c = await p.evaluate(() => window.__ct.cullInfo());
  const indoors = q[0] >= 100;
  const bad = indoors !== c.hiding;
  console.log(`   ${tag.padEnd(22)} x ${q[0].toFixed(2).padStart(8)}  indoors=${String(indoors).padEnd(5)} hiding=${String(c.hiding).padEnd(5)}${bad ? '   <-- MISMATCH' : ''}`);
  return bad;
};
let bad = 0;
bad += await sample('spawn (301)') ? 1 : 0;
// out of the flat: the door is behind you at spawn
await p.evaluate(() => window.__ct.warp(window.__ct.pos()[0], window.__ct.pos()[2], Math.PI / 2, undefined, 0));
for (let i = 0; i < 6; i++) { await hold('w', 500); bad += await sample(`walking out, step ${i + 1}`) ? 1 : 0; }
// press E on whatever is offered (the flat door, then the stair) a few times
for (let i = 0; i < 3; i++) {
  await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
  await p.waitForTimeout(400);
  bad += await sample(`after [E] #${i + 1}`) ? 1 : 0;
  await hold('w', 600);
}
bad += await sample('after the walk') ? 1 : 0;

await browser.close();
console.log('');
if (seam) { console.log(`FAIL — the boundary at x 100 is reachable on foot (got to ${worstX.toFixed(2)})`); process.exit(1); }
if (bad) { console.log(`FAIL — ${bad} sample(s) where the cull state disagreed with where the player was`); process.exit(1); }
console.log('PASS — x 100 is unreachable on foot, and the cull tracked the player at every step');
