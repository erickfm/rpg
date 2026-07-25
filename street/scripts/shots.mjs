// Render one screenshot per prototype world. Boots the built app in Chromium,
// cycles through window.__lab.list(), lets each animate for a beat, and captures.
// Usage: npm run build && npx vite preview --port 4177 &  then
//   node scripts/shots.mjs [outDir]
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { mkdirSync } from 'node:fs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
const outDir = process.argv[2] ?? 'shots';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const errors = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__lab !== undefined, { timeout: 10000 });

await reportWorld(page, URL);   // GOTCHAS 26

const protos = await page.evaluate(() => window.__lab.list());
console.log(`capturing ${protos.length} worlds ->`, outDir);

for (const p of protos) {
  await page.evaluate((k) => window.__lab.setProto(k), p.key);
  await page.waitForTimeout(1800); // let idle animation settle into a lively pose
  await page.screenshot({ path: `${outDir}/${p.key}.png` });
  console.log('  ✓', p.key, '—', p.name);
}

await browser.close();
if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('done');
