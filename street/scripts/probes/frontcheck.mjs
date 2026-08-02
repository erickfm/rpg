// The roster lists BODEGA at frontage centre z 13.43, but doorsweep -- which
// walks -- fires "[E] into the BODEGA" at z -96.0..-94.75, about 109 m away.
// One of those is not the bodega. Look at both.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
await p.goto(aim('http://localhost:4184/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p);
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);
const f = await p.evaluate(() => (globalThis.__frontages||[]).find(q => q.name === 'BODEGA'));
console.log(`roster BODEGA: axis ${f.axis}  span ${f.loWorld} … ${f.hiWorld}  facePos ${f.facePos}  door ${f.doorWorld}`);
for (const [tag, z] of [['roster', (f.loWorld+f.hiWorld)/2], ['doorsweep', -95.4]]) {
  const standX = f.facePos + (f.facePos < 0 ? 8.5 : -8.5);
  const yaw = f.facePos < 0 ? -Math.PI/2 : Math.PI/2;
  await p.evaluate(([x,z,yaw]) => window.__ct.warp(x,z,yaw,0.14,0.04), [standX, z, yaw]);
  await p.waitForTimeout(300);
  await p.screenshot({ path: `shots/fc-${tag}.png` });
  console.log(`   shot fc-${tag}: standing (${standX.toFixed(1)}, ${z.toFixed(2)}) facing the ${f.facePos>0?'east':'west'} facade`);
}
await b.close();
