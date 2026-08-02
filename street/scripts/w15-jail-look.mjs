// LOOK at the jail's back wall, its yard and the screen-wall end caps — the
// three places item 6's seam disagreements actually live. Tag on argv[2].
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { setClock } from './lib/clock.mjs';

const TAG = process.argv[2] ?? 'now';
const URL = aim('http://localhost:4194/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await setClock(p, 13, 0);

const yawTo = (sx, sz, tx, tz) => Math.atan2(tx - sx, -(tz - sz));
// BX = 65 (the back of the building), FENCE_X = 74.65, yard z -110…-96
const views = [
  // standing in the yard looking straight at the BACK wall (the +x face)
  ['back',     71, -103, 65, -103, 1.7],
  // the same wall from mid height, so the upper brick fills the frame
  ['back-up',  70, -103, 65, -103, 5.0],
  // the south screen wall's free END CAP at (74.65, ·, -109.9)
  ['endcap',   72,  -99, 74.6, -109.9, 3.0],
  // the sally port recess, where the lintel and jamb boxes are
  ['port',     59, -103, 61, -103, 1.7],
  // the whole street elevation: the string course, the window sills and the
  // stone-to-brick junction all in one frame
  ['facade',   45, -103, 61, -103, 1.7],
  // along the south screen wall, from inside the yard toward its free end
  ['screen',   67,  -105, 74.6, -109.9, 1.7],
];
for (const [name, x, z, tx, tz, eye] of views) {
  await p.evaluate(([x, z, yaw, eye]) => window.__ct.warp(x, z, yaw, eye, 0),
    [x, z, yawTo(x, z, tx, tz), eye]);
  await p.waitForTimeout(400);
  await p.screenshot({ path: `shots/w15-jail-${name}-${TAG}.png` });
}
console.log(`saved shots/w15-jail-{${views.map(v=>v[0]).join(',')}}-${TAG}.png`);
await b.close();
