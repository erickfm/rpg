// Close-up verification shots: tree pit, pickup bed, dumpster + bags.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4177/');
const outDir = process.argv[2] ?? 'shots';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const errors = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });

await reportWorld(page, URL);   // GOTCHAS 26
await page.waitForTimeout(800);

const spots = [
  ['tree-pit', -3.2, -13, Math.atan2(-2.7, 3)],
  ['pickup', -0.8, -30, Math.atan2(-3.1, 4)],
  ['alley', -8.0, -41, Math.atan2(-2.5, -2.5)],
];
for (const [name, x, z, yaw] of spots) {
  await page.evaluate(([x2, z2, yaw2]) => window.__ct.warp(x2, z2, yaw2), [x, z, yaw]);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/cu-${name}.png` });
}
await browser.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('closeups done ->', outDir);
