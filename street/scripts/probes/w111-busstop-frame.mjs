// ITEM 276 — a frame of the bus stop from the pavement, to compare against the
// user's screenshot, plus where the route net's `e-bench` node actually is.
//
// The user's frame: two citizens standing motionless on the pavement beside the
// bus bench, SLEEP CENTER behind them, in rain. This stands where he stood and
// looks at the same thing, so the geometry can be compared by eye rather than
// asserted. READ-ONLY: item 276 says measure and stop.
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { waitPainted } from '../lib/painted.mjs';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4672/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 740 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await waitPainted(p, { quiet: true });
await p.evaluate(() => window.__ct.clock(9, 30));

// Stand south of the bench on the east walk, looking north up the block -- the
// bench on the left against the kerb, SLEEP CENTER's frontage behind it.
// yaw 0 faces -z (forward is (sin yaw, 0, -cos yaw), crosstown.ts's rig
// convention), and the bench is at z -35, i.e. UP-street from -42. So yaw PI.
// The first run of this probe used yaw 0 and photographed the opposite way.
const STAND = { x: 6.3, z: -42 };
for (let i = 0; i < 6; i++) {
  await p.evaluate((s) => window.__ct.warp(s.x, s.z, Math.PI, 0, -0.12), STAND);
  await waitPainted(p, { quiet: true }); await p.waitForTimeout(250);
  const q = await p.evaluate(() => window.__ct.pos());
  if (Math.hypot(q[0] - STAND.x, q[2] - STAND.z) < 2) break;
}
const cull = await p.evaluate(() => window.__ct.cullInfo());
if (cull.hiding) { console.error('ABORT: exterior culled (GOTCHAS 79b)'); process.exit(3); }
const at = await p.evaluate(() => window.__ct.pos());
console.log(`standing (${at[0].toFixed(2)}, ${at[2].toFixed(2)}) looking north up the east walk`);
await p.waitForTimeout(800);
await waitPainted(p, { quiet: true });
await p.screenshot({ path: 'shots/w111-busstop-north.png' });
console.log('  shots/w111-busstop-north.png');

// and the bench itself, side on from the road side
for (let i = 0; i < 6; i++) {
  await p.evaluate(() => window.__ct.warp(6.4, -35.0, -Math.PI / 2, 0, -0.25));
  await waitPainted(p, { quiet: true }); await p.waitForTimeout(250);
  const q = await p.evaluate(() => window.__ct.pos());
  if (Math.hypot(q[0] - 6.4, q[2] + 35.0) < 2) break;
}
await p.waitForTimeout(800);
await waitPainted(p, { quiet: true });
await p.screenshot({ path: 'shots/w111-busstop-bench.png' });
console.log('  shots/w111-busstop-bench.png');

// WHERE THE NET PUTS A WAITING CITIZEN, against where the bench IS.
const bench = await p.evaluate(() => {
  for (const c of window.__ct.staticColliders()) {
    const w = c.maxX - c.minX, d = c.maxZ - c.minZ;
    if (w > 0.5 && w < 0.9 && d > 1.6 && d < 2.1 && c.minX > 4.5 && c.maxX < 6.5
      && c.minZ > -37 && c.maxZ < -33) return c;
  }
  return null;
});
const NODE_Z = -36.6;      // ct/crowd-net.ts:196, cited not derived — see the note
console.log(`\nbench collider  z ${bench.minZ.toFixed(3)}..${bench.maxZ.toFixed(3)}`
  + `  (centre ${((bench.minZ + bench.maxZ) / 2).toFixed(3)})`);
console.log(`net 'e-bench'   z ${NODE_Z}   -> ${(bench.minZ - NODE_Z).toFixed(3)} m SOUTH of the bench's south face`);
console.log(`                     -> ${(((bench.minZ + bench.maxZ) / 2) - NODE_Z).toFixed(3)} m from the bench centre`);
await b.close();
