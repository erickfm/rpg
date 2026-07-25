// Can a pedestrian get into the lot, and does the fence stop them everywhere
// else? Walks the rig east off the pavement at a range of z and reports how
// far it gets. The collider list alone cannot answer this — a gap in the
// fence is worth nothing if a blanket box is lying across it.
//
// Usage: SHOT_URL=http://localhost:4190/ node scripts/lotwalk.mjs
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4190/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => console.log('PAGEERR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);
await p.mouse.click(640, 360); await p.waitForTimeout(500);

// FACE is 7; the walk is west of it. Start on the pavement and hold W facing east.
const start = 5.6;
for (const z of [-3,-2,-1,-0.5,0,1,2,3,4,5,5.5,6,7,8,10]) {
  await p.evaluate(([x, z]) => window.__ct.warp(x, z, Math.PI / 2, 0.14, 0), [start, z]);
  await p.waitForTimeout(250);
  await p.keyboard.down('w');
  await p.waitForTimeout(2600);
  await p.keyboard.up('w');
  await p.waitForTimeout(200);
  const [x2, , z2] = await p.evaluate(() => window.__ct.pos());
  const got = x2 - start;
  console.log(`z=${String(z).padStart(5)}  walked ${got.toFixed(2)} m east -> x=${x2.toFixed(2)} z=${z2.toFixed(2)}  ${got > 3 ? 'IN' : 'blocked'}`);
}
await b.close();
