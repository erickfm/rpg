// VERIFYING C's "tv off unless i sit down" ROW.
//
// The row's own predicate is `scene.userData.tv.on`, and it claims a STATE
// MACHINE rather than a toggle — "on is a function of whether he is seated
// watching, with no other path to it". The case it says a toggle gets wrong is
// the one to test hardest:
//
//   "after a RESPAWN out of the seat `false`. The sit ends without a stand-up,
//    and the set still goes dark because `on` is derived rather than remembered."
//
// And one claim is about MY file, so I want it measured rather than assumed:
//
//   "I had registered the set through props.ts's addLamp, but that registry is
//    build-time only — nothing unregisters a head — so the TV pooled light on
//    the boards of 301 all night. The lamp is REMOVED."
//
// If a lamp head is still there, the night-grade complaint the user has made
// four times is live again in a room he sleeps in.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { goto, settle } from './lib/reachable.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4279/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1034, height: 757 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(23, 10));

const on = () => p.evaluate(() => {
  const t = window.__ct.scene().userData.tv;
  return t ? t.on : '(no userData.tv)';
});
const pos = () => p.evaluate(() => window.__ct.pos().slice(0, 3).map((v) => +v.toFixed(2)));

console.log('\n── on, across every way of being in the room ──');
await settle(p);
console.log(`  on load / standing at spawn      ${JSON.stringify(await on())}`);

// right next to the set: walk to it rather than warping, so the collider that
// the whole mechanism relies on is exercised
await p.keyboard.down('w'); await p.waitForTimeout(900); await p.keyboard.up('w');
await settle(p);
console.log(`  after walking across the room    ${JSON.stringify(await on())}   at ${JSON.stringify(await pos())}`);

// SEATED — the row's station is "press E at the spawn point"
await p.evaluate(() => window.__ct.warp(0, 0, 0, 0, 0));   // no-op: keep pose
await p.evaluate(() => window.__ct.clock(23, 10));
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.evaluate(() => window.__ct.clock(23, 10));
await settle(p);
await p.keyboard.press('e');
await p.waitForTimeout(1400);
const seated = await on();
console.log(`  seated on the bed                ${JSON.stringify(seated)}`);
await p.screenshot({ path: 'shots/B-verify-C/tvoff-seated.png' });

// THE RESPAWN CASE: end the sit without standing up
await p.evaluate(() => window.__ct.warp(-6, -40, 0, 0.14, 0));
await p.waitForTimeout(900);
const afterWarp = await on();
console.log(`  warped OUT of the seat (respawn) ${JSON.stringify(afterWarp)}   at ${JSON.stringify(await pos())}`);
// AND CHECK WHETHER THE PLAYER IS STILL LOGICALLY SEATED BEFORE CALLING THIS
// A FAULT. `__ct.warp` is a TEST AFFORDANCE that moves rig.pos; measured, it
// does NOT clear rig.seated — `__ct.seated()` still returns the seat pose after
// the warp. So `on` staying true is the state machine working from a `seated`
// that nothing cleared, not a toggle remembering. Reporting "the respawn case
// fails" off a warp would be filing a fault against a path no player has.
const stillSeated = await p.evaluate(() => (typeof window.__ct.seated === 'function'
  ? window.__ct.seated() : null));
console.log(`     __ct.seated() after the warp: ${JSON.stringify(stillSeated)}`);
console.log(`     ${afterWarp === false ? 'DERIVED, not remembered — HOLDS'
  : stillSeated ? 'on is true BECAUSE seated is still true — the warp did not clear it,'
    + ' so this tests the affordance and not the row'
  : '<-- STILL ON with nothing seated: that would be a real fault'}`);
console.log(`  out on the street                ${JSON.stringify(await on())}`);

// ── is a lamp head still standing at the TV? ─────────────────────────────
const lamp = await p.evaluate(() => {
  // props.ts keeps lampHeads private, but a head shows up as a POOL: any
  // material near the TV carrying userData.poolLit while the set is off.
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  let lit = 0, near = 0;
  s.traverse((n) => {
    if (!n.isMesh) return;
    const e = n.matrixWorld.elements;
    if (e[12] < 400) return;                       // the interiors
    if (Math.abs(e[12] - 1000) > 30) return;       // room 301's belt
    near++;
    const m = Array.isArray(n.material) ? n.material[0] : n.material;
    if (m?.userData?.poolLit) lit++;
  });
  return { near, lit };
});
console.log('\n── does the set still light the room when it is off? ──');
console.log(`  ${lamp.near} meshes in the 301 belt, ${lamp.lit} of them held up by a lamp pool` +
  (lamp.lit === 0 ? '   NO POOL — the head really was removed' : '   <-- SOMETHING IS STILL POOLING'));
await b.close();
