// SECOND VERIFIER — C's row: "top right part of window frame" in room 301.
//
// C says the z-fighting at the reveal's top corners is gone, fixed by making
// the head/sill and jambs share no volume, and explicitly invites a re-look:
// "If the user still sees it, it is a different fault and I want the new shot."
//
// So: stand where a player stands IN 301 and look at the top-right corner.
// STATION: spawned into 301 on the third floor via SPAWN, then walked to the
// window wall — the same place the user is standing when he photographs it.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = aim('http://localhost:4188/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 740 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(13, 30));

// the window, read out of the world rather than typed: find the glass pane on
// the third floor of the walk-up and aim at its TOP-RIGHT corner
const w = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  let best = null;
  s.traverse((n) => {
    if (!n.isMesh || n.geometry?.type !== 'PlaneGeometry') return;
    const gp = n.geometry.parameters;
    if (Math.abs(gp.width - 1.3) > 0.01 || Math.abs(gp.height - 1.3) > 0.01) return;
    const e = n.matrixWorld.elements;
    if (e[13] < 5 || e[13] > 9) return;              // third floor
    if (!best || e[13] > best.y) best = { x: e[12], y: e[13], z: e[14] };
  });
  return best;
});
if (!w) { console.error('could not find the 301 window pane'); process.exit(3); }
console.log(`301 window pane at x ${w.x.toFixed(2)} y ${w.y.toFixed(2)} z ${w.z.toFixed(2)}`);

const gy = await p.evaluate(() => window.__ct.groundAt ? 0 : 0);
// three stations a player would actually use, all INSIDE the room facing the wall
const stations = [
  ['square', w.x + 2.4, w.z,        0.10],
  ['offset', w.x + 1.6, w.z - 1.15, 0.16],
  ['close',  w.x + 0.75, w.z - 0.35, 0.24],
];
for (const [tag, sx, sz, pitch] of stations) {
  await p.evaluate(([x, z, pi]) => {
    // face -x, which is where the window wall is from inside the room. I had
    // this at +PI/2 first and photographed the 301/302 DOORS instead — the
    // rig's forward is (sin yaw, 0, -cos yaw), so +PI/2 looks along +x.
    window.__ct.warp(x, z, -Math.PI / 2, undefined, pi);
  }, [sx, sz, pitch]);
  await p.waitForTimeout(500);
  await p.screenshot({ path: `shots/A-v301-${tag}.png` });
  console.log(`  A-v301-${tag}  standing (${sx.toFixed(2)}, ${sz.toFixed(2)}) looking at the window wall`);
}
await b.close();
