// WALK the fixed jail site, on foot, not by warp. Written to verify the
// walkability fix (notes/O-jail-site-walkable.md): the forecourt in front of
// the building and the yard behind it must both be reachable by holding
// movement keys, and __ct.pos() must match where the walk actually stopped.
//
//   SHOT_URL=http://localhost:4181/ node scripts/O-jail-walk-fix.mjs
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('aim it: SHOT_URL=http://localhost:PORT/'); process.exit(2); }

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 620 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await afterFrames(p, 10); await p.waitForTimeout(900);
await p.evaluate(() => window.__ct.clock(13, 0));

const pos = () => p.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(2)));

const walkUntilStopped = async (maxSteps = 140) => {
  let last = null, still = 0;
  for (let i = 0; i < maxSteps && still < 6; i++) {
    await afterFrames(p, 3);
    const q = await p.evaluate(() => window.__ct.pos());
    if (last !== null && Math.hypot(q[0] - last[0], q[2] - last[2]) < 0.01) still++; else still = 0;
    last = q;
  }
  return pos();
};

// ── 1. Walk straight east down the middle of the side street into the
//      forecourt, on foot from the open carriageway. ──────────────────────
console.log('-- 1. walking east into the forecourt --');
await p.evaluate(() => window.__ct.warp(30, -103, Math.PI / 2, 0, 0));
await afterFrames(p, 4);
await p.keyboard.down('w');
const atForecourt = await walkUntilStopped();
await p.keyboard.up('w');
console.log(`   stopped at (${atForecourt[0]}, ${atForecourt[2]})`);
const inForecourt = atForecourt[0] > 56.5 && atForecourt[0] < 61.5;
console.log(`   ${inForecourt ? 'OK ' : 'FAIL'} walked past the old facade line (x 56.88) into the new forecourt, stopped near the building's own face (~61)`);

// ── 2. From there, is the door's [E] actually in reach, on foot? ─────────
const reach = await p.evaluate(() => {
  const q = window.__ct.pos();
  // READ, not retyped — the margin is one global in fp.ts and the world
  // publishes it. A hand-typed 0.6 here asserted against a number that would
  // stop being true the day anyone re-tuned reach. (BUILDER-BRIEF §8)
  //
  // AND IT IS THE TOUCH MARGIN, NOT THE REACH ONE (item 232). This read
  // `reachMargin()` (0.6). The player is STANDING at the jail door and
  // `fp.ts:991` decides an unaimed standing offer with `d < s.r + TOUCH_MARGIN`
  // (0.15); `REACH_MARGIN` survives only in the seated clause (`fp.ts:1006`)
  // and the debug ring (`fp.ts:1124`). Corrected here to match
  // `scripts/O-jail-walk.mjs`, the registered check this probe diagnoses — a
  // diagnostic that models a different predicate from the check it explains is
  // worse than none.
  const TOUCH_MARGIN = window.__ct.touchMargin();
  // item 309: the aim-free disc is trimmed world-wide, so the margin alone
  // over-reports it by 20%. `reachTrim()` is the missing term.
  const REACH_TRIM = window.__ct.reachTrim ? window.__ct.reachTrim() : 1;
  return window.__ct.spots()
    .filter((s) => /DETENTION/i.test(s.label ?? ''))
    .map((s) => ({ label: s.label, d: +Math.hypot(s.x - q[0], s.z - q[2]).toFixed(2), ok: s.ok, r: s.r }))
    .map((s) => ({ ...s, near: s.d < (s.r + TOUCH_MARGIN) * REACH_TRIM }));
});
console.log('   jail spots in reach:', JSON.stringify(reach));
console.log(`   ${reach.some((r) => r.near && r.ok) ? 'OK ' : 'FAIL'} the door prompt is live from where the walk stopped`);

// ── 3. Walk the width of the forecourt, north edge to south edge, to prove
//      it is a real 2D plaza and not a 1-wide corridor. Camera forward is
//      (sin yaw, -cos yaw) (GOTCHAS §33) — yaw PI/2 walks +x, yaw 0 walks
//      -z (south, toward more negative z), yaw PI walks +z (north). ───────
console.log('\n-- 2. walking the forecourt north/south --');
await p.evaluate(() => window.__ct.warp(59, -103, Math.PI, window.__ct.groundAt(59, -103), 0));
await afterFrames(p, 4);
await p.keyboard.down('w'); // yaw PI -> +z, toward the north edge (-96)
const north = await walkUntilStopped(60);
await p.keyboard.up('w');
console.log(`   walked to (${north[0]}, ${north[2]})`);
await p.evaluate(() => window.__ct.warp(59, -103, 0, window.__ct.groundAt(59, -103), 0));
await afterFrames(p, 4);
await p.keyboard.down('w'); // yaw 0 -> -z, toward the south edge (-110)
const south = await walkUntilStopped(60);
await p.keyboard.up('w');
console.log(`   walked to (${south[0]}, ${south[2]})`);
const spread = Math.abs(north[2] - south[2]);
console.log(`   ${spread > 8 ? 'OK ' : 'FAIL'} forecourt is walkable across its width — ${spread.toFixed(2)} m of north/south travel`);

// ── 4. The yard behind the building: confirm it is genuinely open ground
//      (not merely un-reverted) by walking INTO it from a warp just short of
//      it, on foot, in all four directions, and checking against the fence
//      and the building's own back wall. ──────────────────────────────────
console.log('\n-- 3. walking the yard behind the jail --');
await p.evaluate(() => window.__ct.warp(70, -103, Math.PI / 2, window.__ct.groundAt(70, -103), 0));
await afterFrames(p, 4);
await p.keyboard.down('w'); // yaw PI/2 -> +x, toward the fence at ~74.65
const east = await walkUntilStopped(60);
await p.keyboard.up('w');
console.log(`   walked east to (${east[0]}, ${east[2]}) -- expect to stop near the fence (~74.6)`);
await p.evaluate(([x, z]) => window.__ct.warp(x, z, -Math.PI / 2, window.__ct.groundAt(x, z), 0), [east[0], east[2]]);
await afterFrames(p, 4);
await p.keyboard.down('w'); // yaw -PI/2 -> -x, back toward the building's rear wall (~65)
const west = await walkUntilStopped(60);
await p.keyboard.up('w');
console.log(`   walked west to (${west[0]}, ${west[2]}) -- expect to stop near the building's back wall (~65)`);
const yardSpan = Math.abs(east[0] - west[0]);
const inYard = east[0] > 73 && east[0] < 76 && west[0] > 64 && west[0] < 67;
console.log(`   ${inYard ? 'OK ' : 'FAIL'} the yard is walkable end to end on foot — ${yardSpan.toFixed(2)} m, fence to building wall`);

await b.close();
