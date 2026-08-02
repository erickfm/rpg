import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
const look = (x, z, tx, tz) => Math.atan2(tx - x, -(tz - z));
// blade at (44.35, 7.4, -96.72), faces at x 44.22 / 44.48, 1.5w x 6.2h
// marquee at (51.225, 25.2, -95.0), faces at x 50.94 / 51.52, 8.8w x 7.0h
const S = [
  ['Z-blade-from-east', 49.0, -96.72, look(49.0,-96.72, 44.35,-96.72), 0, 0.30],
  ['Z-blade-from-west', 39.5, -96.72, look(39.5,-96.72, 44.35,-96.72), 0, 0.30],
  ['Z-blade-east-near', 46.5, -96.72, look(46.5,-96.72, 44.35,-96.72), 0, 0.55],
  ['Z-blade-west-near', 42.0, -96.72, look(42.0,-96.72, 44.35,-96.72), 0, 0.55],
  ['Z-marquee-east',    62.0, -95.0,  look(62.0,-95.0, 51.2,-95.0),   0, 0.95],
  ['Z-marquee-west',    40.0, -95.0,  look(40.0,-95.0, 51.2,-95.0),   0, 0.95],
  ['Z-marquee-support', 44.0, -99.0,  look(44.0,-99.0, 51.2,-95.5),   0, 0.90],
  ['Z-marquee-street',  20.0, -103,   look(20.0,-103, 51.2,-95.0),    0, 0.42],
  ['Z-church-tower',     8.0, -103,   look(8.0,-103, 6.5,-110),       0, 0.75],
  ['Z-church-tower-2',  -2.0, -104,   look(-2.0,-104, 6.5,-110),      0, 0.62],
  ['Z-burger-close',    -1.0, -29,    look(-1.0,-29, -7,-29),         0, 0.30],
  ['Z-burger-night',    -1.0, -29,    look(-1.0,-29, -7,-29),         0, 0.30, [22,30]],
];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4182/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, process.env.SHOT_URL ?? 'http://localhost:4182/');   // GOTCHAS 26: prove it, do not just name it
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(700);
for (const [l,x,z,yaw,gy,pitch,hm] of S) {
  await p.evaluate(([x,z,yaw,gy,pitch,hm]) => { if (hm) window.__ct.clock(hm[0],hm[1]); window.__ct.warp(x,z,yaw,gy,pitch); }, [x,z,yaw,gy,pitch,hm??null]);
  await p.waitForTimeout(hm?900:250);
  await p.screenshot({ path: `shots/seam2-${l}.png` });
  if (hm) await p.evaluate(() => window.__ct.clock(13,0));
}
await b.close(); console.log('ok');
