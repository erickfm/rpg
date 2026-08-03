// What sites does the world publish, and how big is each? Item 215 scoping.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const URL = aim('http://localhost:4310/');
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 900, height: 600 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
const sites = await page.evaluate(() => window.__ct.sites());
for (const [n, s] of Object.entries(sites)) {
  console.log(`${n.padEnd(14)} x ${s.minX.toFixed(2)}…${s.maxX.toFixed(2)} (${(s.maxX - s.minX).toFixed(2)})  z ${s.minZ.toFixed(2)}…${s.maxZ.toFixed(2)} (${(s.maxZ - s.minZ).toFixed(2)})  y ${s.y}`);
}
console.log(`\n${Object.keys(sites).length} sites`);
await b.close();
