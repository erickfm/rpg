// Item 249 — WHICH WAY IS THE CAMERA POINTING AFTER A WARP?
//
// A one-shot: the first attempt to photograph the chair shot the opposite wall,
// and reading `__ct.camera()` in the same tick as the warp reports the SPAWN,
// because the rig is copied onto the camera in the render loop and `evaluate`
// gets no frames. So: warp, WAIT FOR FRAMES, then read. Keeps the yaw
// convention measured rather than guessed for the shot probe beside it.
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4750/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await waitPainted(p);
await p.waitForTimeout(600);

const seat = await p.evaluate(() => {
  let s = null;
  window.__ct.scene().traverse((o) => {
    const g = o.geometry && o.geometry.parameters;
    if (!g || g.width === undefined) return;
    if (Math.abs(g.width - 0.42) > 1e-4 || Math.abs(g.height - 0.04) > 1e-4
      || Math.abs(g.depth - 0.40) > 1e-4) return;
    s = { x: o.position.x, y: o.position.y, z: o.position.z };
  });
  return s;
});
console.log('seat pan', seat);

for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
  await p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z - 1.2, yaw, undefined, 0),
    [seat.x, seat.z, yaw]);
  await p.waitForTimeout(500);
  const r = await p.evaluate(() => {
    const c = window.__ct.camera();
    const d = new c.position.constructor(0, 0, -1).applyQuaternion(c.quaternion);
    return { cam: [+c.position.x.toFixed(2), +c.position.y.toFixed(2), +c.position.z.toFixed(2)],
             dir: [+d.x.toFixed(2), +d.z.toFixed(2)] };
  });
  console.log(`yaw ${yaw.toFixed(2)}  cam ${r.cam.join(',')}  looking dx=${r.dir[0]} dz=${r.dir[1]}`);
}
await b.close();
