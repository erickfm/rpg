// ITEM 141: the frames a player actually stands in, before and after the cull.
//
// The item's DONE WHEN says "the view through the window is still recognisably
// the street ... frames, from his own standing position". Those frames are
// taken here, at the stations the user is in when he reports the drag — the
// window from across the room, the window from the bed, and the landing — plus
// the street looking east, which is the direction a region cull could damage.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w53-shots.mjs <tag>
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { reportWorld } from '../lib/which-world.mjs';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4183/');
const TAG = process.argv[2] ?? 'before';
mkdirSync('shots', { recursive: true });

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1200, height: 740 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(13, 30));

const win = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  let best = null;
  s.traverse((n) => {
    if (!n.isMesh || n.geometry?.type !== 'PlaneGeometry') return;
    const gp = n.geometry.parameters;
    if (Math.abs(gp.width - 1.3) > 0.01 || Math.abs(gp.height - 1.3) > 0.01) return;
    const e = n.matrixWorld.elements;
    if (e[13] < 5 || e[13] > 9) return;
    if (!best || e[13] > best.y) best = { x: e[12], y: e[13], z: e[14] };
  });
  return best;
});
const spawn = await p.evaluate(() => window.__ct.pos());
const W = -Math.PI / 2;                       // facing the window wall (-x)

const STATIONS = [
  ['win-across', win.x + 2.40, win.z,        W,     spawn[3], 0.05],
  ['win-close',  win.x + 0.85, win.z,        W,     spawn[3], 0.05],
  ['win-up',     win.x + 1.60, win.z,        W,     spawn[3], 0.45],   // up into the well
  ['win-down',   win.x + 1.60, win.z,        W,     spawn[3], -0.35],  // down the well
  ['win-offset', win.x + 1.60, win.z - 1.15, W,     spawn[3], 0.10],
  ['away',       win.x + 2.40, win.z,        Math.PI / 2, spawn[3], 0],
  ['spawn',      spawn[0],     spawn[2],     W,     spawn[3], 0],
  ['street-e',   0, 0, Math.PI / 2, 0, 0],       // on the street looking EAST
  ['street-n',   0, 0, 0,           0, 0],
];

for (const [tag, x, z, yaw, gy, pitch] of STATIONS) {
  await p.evaluate(([x, z, yaw, gy, pi]) => window.__ct.warp(x, z, yaw, gy, pi), [x, z, yaw, gy, pitch]);
  await p.waitForTimeout(700);
  await p.screenshot({ path: `shots/w53-${TAG}-${tag}.png` });
  console.log(`  shots/w53-${TAG}-${tag}.png   (${x.toFixed(2)}, ${z.toFixed(2)}) yaw ${yaw.toFixed(2)} pitch ${pitch}`);
}
await browser.close();
