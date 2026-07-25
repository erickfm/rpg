import { chromium } from 'playwright';
const look = (x, z, tx, tz) => Math.atan2(tx - x, -(tz - z));
const S = [
  ['W-marquee-east-reach', 55.5, -100.5, look(55.5,-100.5, 51.2,-95.0), 0, 0.85],
  ['W-marquee-east-r2',    56.0, -103.0, look(56.0,-103.0, 51.2,-95.0), 0, 0.72],
  ['W-marquee-west-reach', 34.0, -103.0, look(34.0,-103.0, 51.2,-95.0), 0, 0.55],
  ['W-blade-east-reach',   50.0, -99.0,  look(50.0,-99.0, 44.35,-96.72), 0, 0.45],
];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4182/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(700);
for (const [l,x,z,yaw,gy,pitch] of S) {
  await p.evaluate(([x,z,yaw,gy,pitch]) => window.__ct.warp(x,z,yaw,gy,pitch), [x,z,yaw,gy,pitch]);
  await p.waitForTimeout(250);
  await p.screenshot({ path: `shots/seam2-${l}.png` });
}
await b.close(); console.log('ok');
