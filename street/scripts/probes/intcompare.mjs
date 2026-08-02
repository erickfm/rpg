// Matched-camera comparison of the three rooms that are in the world, so light
// level, colour temperature and jamb reveal can be judged as a SET rather than
// measured one at a time. Same relative station in each room: 1.5 m in from the
// front wall, on the room centreline, looking at the back wall, same pitch.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
const R = [
  { id: 'diner',  cx: 440, hd: 3.5,  at: -2.6 },
  { id: 'burger', cx: 520, hd: 4.25, at: -3.6 },
  { id: 'thrift', cx: 600, hd: 3.25, at: -2.2 },
];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
await p.goto(aim('http://localhost:4184/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, aim('http://localhost:4184/'));   // GOTCHAS 26: prove it, do not just name it
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(800);
for (const r of R) {
  // back wall, matched station
  await p.evaluate((a) => window.__ct.warp(a[0], a[1], 0, 0, 0.02), [r.cx, r.hd - 1.5]);
  await p.waitForTimeout(260);
  await p.screenshot({ path: `shots/cmp-${r.id}-back.png` });
  // the doorway reveal, from inside, one step off the jamb
  await p.evaluate((a) => window.__ct.warp(a[0], a[1], Math.PI, 0, 0.02), [r.cx + r.at + 0.9, r.hd - 1.6]);
  await p.waitForTimeout(260);
  await p.screenshot({ path: `shots/cmp-${r.id}-reveal.png` });
  // straight up: the ceiling
  await p.evaluate((a) => window.__ct.warp(a[0], 0, 0, 0, 1.25), [r.cx]);
  await p.waitForTimeout(260);
  await p.screenshot({ path: `shots/cmp-${r.id}-ceil.png` });
}
await b.close(); console.log('ok');
