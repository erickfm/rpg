// Where does the world actually offer the way into the jail? Scan, and print
// the hint at every station, rather than guessing a standoff.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4184/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(13, 0));
await p.evaluate(() => window.__ct.warp(58.9, -103, Math.PI / 2, 0.14, 0));
await p.waitForTimeout(1800);

const hint = () => p.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').trim());
const DOORX = 61.505, DOORZ = -103.0;
const hits = [];
for (let back = 0.4; back <= 3.2; back += 0.3) {
  for (const dz of [-1.2, -0.6, 0, 0.6, 1.2]) {
    const x = DOORX - back, z = DOORZ + dz;
    const gy = await p.evaluate(([xx, zz]) => window.__ct.groundAt(xx, zz), [x, z]);
    await p.evaluate(([xx, zz, g]) => window.__ct.warp(xx, zz, Math.PI / 2, g, 0), [x, z, gy]);
    await p.waitForTimeout(190);
    const h = await hint();
    const e = h.match(/\[E\][^·|]*/);
    if (e) hits.push({ x: +x.toFixed(2), z: +z.toFixed(2), gy: +gy.toFixed(2), e: e[0].trim() });
  }
}
console.log(`stations offering an [E]: ${hits.length}`);
for (const h of hits) console.log(`   (${h.x}, ${h.z}) gy ${h.gy}  ->  ${h.e}`);
if (!hits.length) {
  console.log('  none. what does the HUD say at the closest station?');
  await p.evaluate(() => window.__ct.warp(60.8, -103, Math.PI / 2, 0.14, 0));
  await p.waitForTimeout(500);
  console.log('  ' + JSON.stringify(await hint()));
  console.log('  ground at the door: ' + await p.evaluate(() => window.__ct.groundAt(60.8, -103)));
  await p.screenshot({ path: 'shots/w60-jail-nospot.png' });
  console.log('  shots/w60-jail-nospot.png');
}
await b.close();
