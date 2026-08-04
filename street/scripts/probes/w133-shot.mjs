// LOOK at 301's south wall with the calendar where item 308 put it. For
// LOOKING, never for proving — two runs of identical code differ ~20% of
// pixels (CLAUDE.md). The proof is w133-calendar-walk; this is so a human can
// see the page is not clipping the corner or the crate.
//   SHOT_URL=http://localhost:4186/ node scripts/probes/w133-shot.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const URL = aim('http://localhost:4186/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 680 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.waitForTimeout(1800);
const gy = await p.evaluate(() => window.__ct.groundAt(199.36, -15.545));
for (const [name, x, z, yaw] of [
  ['w133-wall', 199.20, -16.00, 0],          // the whole south wall, head on
  ['w133-page', 199.20, -16.60, 0],          // walking up to the page
]) {
  await p.evaluate(([x, z, y, gy]) => window.__ct.warp(x, z, y, gy, 0), [x, z, yaw, gy]);
  await p.waitForTimeout(900);
  await p.screenshot({ path: `shots/${name}.png` });
  console.log(`shots/${name}.png  from (${x}, ${z})`);
}
await b.close();
