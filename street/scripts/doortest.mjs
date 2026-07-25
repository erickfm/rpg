import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
console.error(`[measuring ${process.env.SHOT_URL}]`);   // say WHICH world — 24163f69
await p.goto(process.env.SHOT_URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
const at = async () => p.evaluate(() => window.__ct.pos());
const press = async () => { await p.keyboard.down('e'); await p.waitForTimeout(90); await p.keyboard.up('e'); await p.waitForTimeout(500); };
// stand at the walk-up door, press E, expect to be teleported inside (x > 100)
await p.evaluate(() => window.__ct.warp(6.55, -44, -Math.PI/2, 0.14, 0));
await p.waitForTimeout(400); await press();
const inside = (await at())[0] > 100;
// and back out
await press();
const back = (await at())[0] < 100;
// bodega
await p.evaluate(() => window.__ct.warp(8.7, -96.85, 0, 0.14, 0));
await p.waitForTimeout(400); await press();
const bodega = (await at())[0] > 230;
console.log(`walk-up in: ${inside ? 'OK' : 'FAIL'}   back out: ${back ? 'OK' : 'FAIL'}   bodega in: ${bodega ? 'OK' : 'FAIL'}`);
await b.close();
