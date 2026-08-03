// Is z > 14.2 east of the lot's frontage really OUT OF THE WORLD, or is it
// legitimate ground the sweep is wrong about? Item 215. LOOK, don't assume.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const URL = aim('http://localhost:4310/');
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 960, height: 640 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await page.waitForTimeout(1500);
await page.evaluate(() => window.__ct.clock(13, 0));
await page.waitForTimeout(600);

const shots = [
  ['inside-lot', 12, 10, 0],           // in the lot, looking north
  ['escape-z17', 12, 17, 0],           // out past it
  ['escape-z19-look-s', 12, 19, Math.PI],
  ['escape-z19-look-n', 12, 19, 0],
  ['escape-z19-look-e', 12, 19, -Math.PI / 2],
  ['street-z17-x0', 0, 17, 0],         // is the ROAD open this far north too?
];
for (const [nm, x, z, yaw] of shots) {
  await page.evaluate(([x, z, yaw]) =>
    window.__ct.warp(x, z, yaw, window.__ct.groundAt(x, z) ?? 0.14, 0), [x, z, yaw]);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `shots/w75-${nm}.png` });
  const p = await page.evaluate(() => window.__ct.pos());
  console.log(`${nm.padEnd(20)} asked (${x}, ${z}) -> stands (${p[0].toFixed(2)}, ${p[2].toFixed(2)})`);
}
// how far north can you actually get, and what is the world's own clamp?
const probe = await page.evaluate(() => {
  const g = [];
  for (let z = 12; z <= 30; z += 1) g.push([z, window.__ct.groundAt(12, z)]);
  return g;
});
console.log('\ngroundAt(12, z):');
for (const [z, y] of probe) console.log(`  z ${z}  ->  ${y === null || y === undefined ? 'NONE' : y.toFixed(3)}`);
await b.close();
