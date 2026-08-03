// STEP-BY-STEP: where does the northward walk up a landing actually stop?
// Prints the position after every held key, so a wall (position plateaus) can
// be told apart from lost input (position stops changing for another reason).
//
// Usage: SHOT_URL=http://localhost:4192/ node scripts/probes/w61-halltrace.mjs [floor]
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';

const URL = aim('http://localhost:4192/');
const FLOOR = Number(process.argv[2] ?? 0);
const APT_X = 200, APT_Z = -20, ST = 2.7;
const AX = (l) => APT_X + l, AZI = (l) => APT_Z + l;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ct, null, { timeout: 60000 });
await afterFrames(page, 3);
const hold = async (k, ms) => {
  await page.keyboard.down(k); await page.waitForTimeout(ms);
  await page.keyboard.up(k); await page.waitForTimeout(60);
};
const pos = () => page.evaluate(() => {
  const [x, , z, gy] = window.__ct.pos(); return { x, z, gy };
});

await page.evaluate(([x, z, y, gy]) => window.__ct.warp(x, z, y, gy, 0),
  [AX(1.9), AZI(1.0), Math.PI, FLOOR * ST]);
await afterFrames(page, 2);
console.log(`floor ${FLOOR + 1}, walking +z from AZI(1.0):`);
let prev = await pos();
console.log(`  start  x=${prev.x.toFixed(3)} z=${prev.z.toFixed(3)} gy=${prev.gy.toFixed(2)}`);
for (let i = 0; i < 20; i++) {
  await hold('w', 200);
  const p = await pos();
  const d = Math.hypot(p.x - prev.x, p.z - prev.z);
  console.log(`  step ${String(i + 1).padStart(2)}  x=${p.x.toFixed(3)} z=${p.z.toFixed(3)} `
    + `gy=${p.gy.toFixed(2)}  moved ${d.toFixed(3)}`);
  prev = p;
}
await browser.close();
