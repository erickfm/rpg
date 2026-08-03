// IS THE STOCK VISIBLE IN THE WINDOW? Item 166.
// Straight across the road at three points along the 13 m front, pitched onto
// the glass, so the street tree in front of the middle cannot hide the answer.
//   SHOT_URL=http://localhost:4420/ node scripts/probes/w86-mattress-window.mjs
import { chromium } from 'playwright';
import { waitPainted } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL || 'http://localhost:4420/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 620 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);

// LIQUOR's slot was EAST z -22..-35 (seams4.mjs's run table); face on x = +7.
for (const [tag, z] of [['n', -24.5], ['mid', -28.5], ['s', -32.5]]) {
  for (const [dtag, x, pitch] of [['far', -4.2, 0.09], ['near', 2.5, 0.20]]) {
    await p.evaluate(([x, z, pi]) => window.__ct.warp(x, z, Math.PI / 2, undefined, pi), [x, z, pitch]);
    await waitPainted(p, { quiet: true });
    await p.screenshot({ path: `shots/w86-win-${tag}-${dtag}.png` });
  }
}
console.log('shots -> shots/w86-win-*.png');
await b.close();
