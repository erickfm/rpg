// VERIFYING O's CLAIM THAT THE RING CLOSES ON FOOT.
//
// This one is mine to care about: I removed the east-end crossing on the user's
// request, and said in the ledger that the paint going without the graph edge
// going would leave walkers crossing ten metres of open road with nothing
// marking it. The desk routed H and O to close the ring another way. O's row
// says it is closed — "north pavement to south pavement across the closed end
// without entering the carriageway".
//
// O's own check says so too, 11 of 11. But a check its author wrote and its
// author runs is exactly what this project has been burned by, so this walks it
// with an instrument that does not import anything of O's, and records the
// SMALLEST x reached — because the failure mode is not "cannot get there", it
// is "gets there by cutting the corner through the road".
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { goto, settle } from '../lib/reachable.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4279/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 620 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(13, 0));

const at = () => p.evaluate(() => window.__ct.pos().slice(0, 3).map((v) => +v.toFixed(2)));
// THE CARRIAGEWAY at the closed end: the side street's asphalt runs z -98..-108
// between the kerbs, and the pavement wraps the end outside x = 55. So "in the
// road" is x < 55 while between those z. One sample inside that box fails it.
const inRoad = (q) => q[0] < 55.0 && q[2] < -97.9 && q[2] > -108.1;

const leg = async (key, stop, limit = 220) => {
  await p.keyboard.down(key);
  const path = [];
  let last = await at();
  for (let i = 0; i < limit; i++) {
    await p.waitForTimeout(100);
    const now = await at();
    path.push(now);
    last = now;
    if (stop(now)) break;
  }
  await p.keyboard.up(key);
  await p.waitForTimeout(120);
  return { path, end: last };
};

console.log('\n── walking the closed end: north pavement -> south pavement ──');
// start on the NORTH walk, hard against the jail, facing south
await p.evaluate(() => window.__ct.warp(56.2, -97.0, 0, 0.14, 0));
await settle(p);
const start = await at();
console.log(`  start ${JSON.stringify(start)} (north pavement, outside the kerb at x 55)`);

const a = await leg('w', (q) => q[2] < -109.0);
const all = [start, ...a.path];
const minX = Math.min(...all.map((q) => q[0]));
const road = all.filter(inRoad);
console.log(`  ended ${JSON.stringify(a.end)}`);
console.log(`  ${all.length} samples, SMALLEST x reached ${minX.toFixed(2)}` +
  `  (the kerb is at x 55 — anything below it between z -98 and -108 is the carriageway)`);
console.log(`  samples inside the carriageway: ${road.length}` +
  (road.length ? `   <-- ${JSON.stringify(road.slice(0, 3))}` : '   NONE — it stayed on pavement'));
const arrived = a.end[2] < -108.1;
console.log(`  reached the south pavement: ${arrived ? 'YES' : 'NO'}`);
console.log(`  VERDICT: ${arrived && road.length === 0
  ? 'THE RING CLOSES ON FOOT WITHOUT ENTERING THE ROAD'
  : 'NOT SETTLED — see above'}`);

for (const [name, x, z, yaw, pitch] of [
  ['end-from-street', 40.0, -103.0, Math.PI / 2, -0.04],
  ['end-on-walk', 56.2, -103.0, Math.PI / 2, -0.10],
]) {
  await p.evaluate(([X, Z, Y, P]) => window.__ct.warp(X, Z, Y, 0.14, P), [x, z, yaw, pitch]);
  const l = await settle(p);
  const f = `shots/B-verify-O/${name}.png`;
  await p.screenshot({ path: f });
  console.log(`  ${f.padEnd(38)} mean ${l.toFixed(4)}`);
}
await b.close();
