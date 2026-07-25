import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(600);
const r = await p.evaluate(() => ({
  hasStand: typeof window.__ct.stand,
  keys: Object.keys(window.__ct).sort().join(' '),
}));
console.log('typeof __ct.stand =', r.hasStand);
console.log('__ct keys:', r.keys);
await b.close();
