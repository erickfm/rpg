import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const look = (x, z, tx, tz) => Math.atan2(tx - x, -(tz - z));
const S = [
  ['R-side-red-kerb',   25, -101, look(25,-101, 12,-98), 0, -0.3],
  ['R-side-red-kerb2',  30, -100.5, look(30,-100.5, 55,-98), 0, -0.25],
  ['R-res-band-seam',    2, -44, look(2,-44, 7,-44), 0, 0.30],
  ['R-res-band-seam-cl', 5.4, -47, look(5.4,-47, 7,-43), 0.14, 0.25],
  ['R-shop-band-seam',  -1.5, -68, look(-1.5,-68, 7,-68), 0, 0.15],
  ['R-ramp-elev',        3.2, -99.5, look(3.2,-99.5, 6.4,-97.4), 0, -0.30],
  ['R-ramp-elev-graze',  1.5, -97.8, look(1.5,-97.8, 6.6,-97.6), 0, -0.22],
  ['R-parapet',          6.3, -70, look(6.3,-70, 6.9,-30), 0.14, 1.10],
  ['R-hotel',           -1.0, -88, look(-1.0,-88, -7,-92), 0, 0.30],
  ['R-bodega-arris-tight', 6.55, -95.0, look(6.55,-95.0, 7.6,-95.1), 0, 0.30],
  ['R-catch-basin',      4.4, -91.0, look(4.4,-91.0, 5.2,-92.6), 0, -0.55],
  ['R-night-corner',     3.5, -100.5, look(3.5,-100.5, 8,-95), 0, 0.15, [22,30]],
];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
await p.goto(aim('http://localhost:4182/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, aim('http://localhost:4182/'));   // GOTCHAS 26: prove it, do not just name it
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(700);
for (const [l,x,z,yaw,gy,pitch,hm] of S) {
  await p.evaluate(([x,z,yaw,gy,pitch,hm]) => { if (hm) window.__ct.clock(hm[0],hm[1]); window.__ct.warp(x,z,yaw,gy,pitch); }, [x,z,yaw,gy,pitch,hm??null]);
  await p.waitForTimeout(hm?900:250);
  await p.screenshot({ path: `shots/seam-${l}.png` });
}
await b.close(); console.log('ok');
