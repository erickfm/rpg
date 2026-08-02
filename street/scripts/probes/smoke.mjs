// Crosstown small-world smoke: boot, spawn shot, walk the block, check the
// dead end holds, look back up the street. Fails on any page error.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
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
await page.waitForTimeout(1400);
await page.screenshot({ path: `${outDir}/sw-spawn.png` });

// walk halfway down
await page.keyboard.down('Shift'); await page.keyboard.down('w');
await page.waitForTimeout(5000);
await page.keyboard.up('w'); await page.keyboard.up('Shift');
await page.waitForTimeout(400);
await page.screenshot({ path: `${outDir}/sw-mid.png` });

// warp to the dead end and look at the closing building
await page.evaluate(() => window.__ct.warp(0, -84, Math.PI));
await page.waitForTimeout(900);
await page.screenshot({ path: `${outDir}/sw-end.png` });

// look back up the street from the end
await page.evaluate(() => window.__ct.warp(0, -88, 0));
await page.waitForTimeout(900);
await page.screenshot({ path: `${outDir}/sw-back.png` });

await browser.close();
if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('smoke done ->', outDir);
