import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(process.env.SHOT_URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(p, process.env.SHOT_URL);   // GOTCHAS 26: prove it, do not just name it
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(600);
const shot = async (n, fn) => { await p.evaluate(fn); await p.waitForTimeout(320);
  await p.screenshot({ path: `shots/lit-${n}.png` }); };
await shot('gutter', () => window.__ct.warp(5.0, -47.0, -Math.PI/2, 0, -0.75));
await shot('walk', () => window.__ct.warp(5.6, -46.6, Math.PI, 0, -0.8));
await b.close(); console.log('litter shots done');
