// ITEM 158 — look at the west wall of the library, where the intersecting
// table stands. Library is cx 1080 cz 0, 20 x 22 (asked, not derived —
// GOTCHAS 86), so the west wall is x 1070 and the candidate is at (1070.35, -1.9).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { waitPainted } from '../lib/painted.mjs';
const URL = process.env.SHOT_URL || 'http://localhost:4430/';
const SUF = process.argv[2] ? `-${process.argv[2]}` : '';
mkdirSync('shots', { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
const errors = [];
p.on('pageerror', (e) => errors.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await waitPainted(p);
await p.evaluate(() => window.__ct.clock(13, 0));
for (const [tag, x, z, yaw, pitch] of [
  ['west-wall', 1074.5, -1.9, -Math.PI / 2, 0.02],
  ['oblique', 1074.0, -5.2, Math.atan2(1070.35 - 1074.0, -(-1.9 - -5.2)), 0.02],
  ['close', 1072.2, -1.9, -Math.PI / 2, -0.10],
]) {
  await p.evaluate(([X, Z, Y, P]) => window.__ct.warp(X, Z, Y, 0, P), [x, z, yaw, pitch]);
  await p.waitForTimeout(350); await waitPainted(p);
  await p.screenshot({ path: `shots/w87-158-${tag}${SUF}.png` });
  console.log(`  shots/w87-158-${tag}${SUF}.png`);
}
console.log(`console errors: ${errors.length}`);
await b.close();
