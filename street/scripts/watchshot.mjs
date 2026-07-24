import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(process.env.SHOT_URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.evaluate(() => { window.__ct.clock(16, 12); window.__ct.warp(-1.4, -20, Math.PI, 0, -1.25); });
await p.waitForTimeout(1200);
await p.screenshot({ path: 'shots/watch-v5.png' });
await b.close(); console.log('watch shot done');
