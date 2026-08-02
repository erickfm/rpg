// w35 — can this probe take a NON-BLACK shot at all? Isolating whether the black
// cat frame was the world or the capture.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await p.goto(aim('http://localhost:4191/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.waitForTimeout(700);
mkdirSync('shots/w35', { recursive: true });
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(400);
await p.screenshot({ path: 'shots/w35/chk-spawn.png' });
// out on the street, where every other instrument shoots from
await p.evaluate(() => window.__ct.warp(-6, -20, 0, 0, 0));
await p.waitForTimeout(400);
await p.screenshot({ path: 'shots/w35/chk-street.png' });
// the alley mouth, the L187 neighbourhood
await p.evaluate(() => window.__ct.warp(-8.5, -39.5, -0.785, 0, 0));
await p.waitForTimeout(400);
await p.screenshot({ path: 'shots/w35/chk-alley.png' });
console.log('shots written');
await b.close();
