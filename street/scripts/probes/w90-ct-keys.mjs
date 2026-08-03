// w90 — what does __ct actually expose, and where do the hud hooks live?
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { goto } from '../lib/reachable.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 880, height: 750 } });
await goto(page, aim('http://localhost:4177/'));
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await page.waitForTimeout(800);

const r = await page.evaluate(() => {
  const walk = (o, d) => {
    const out = {};
    for (const k of Object.keys(o)) {
      const v = o[k];
      out[k] = typeof v === 'function' ? 'fn' : (v && typeof v === 'object' && d > 0 ? walk(v, d - 1) : typeof v);
    }
    return out;
  };
  return walk(window.__ct, 1);
});
console.log(JSON.stringify(r, null, 1));
await browser.close();
