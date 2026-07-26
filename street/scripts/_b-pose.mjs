import { chromium } from 'playwright';
const URL = 'http://localhost:4279/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1034, height: 757 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.evaluate(() => window.__ct.clock(22, 30));
const poses = [
  ['a', 6.0, 15.0, 0, -0.85],
  ['b', 6.0, 12.0, 0, -0.75],
  ['c', 6.3, 9.0,  0, -0.65],
  ['d', 5.6, 14.0, 0.25, -0.9],
  ['e', 6.0, 8.0,  0.2, -0.8],
];
for (const [n, x, z, yaw, pitch] of poses) {
  await p.evaluate(([X,Z,Y,P]) => window.__ct.warp(X, Z, Y, 0.14, P), [x,z,yaw,pitch]);
  await p.waitForTimeout(500);
  await p.screenshot({ path: `shots/_b-pose-${n}.png` });
}
console.log('ok');
await b.close();
