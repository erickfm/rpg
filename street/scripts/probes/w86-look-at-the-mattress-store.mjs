// LOOK AT THE NEW SHOPFRONT FROM THE PAVEMENT. Item 166.
//
// The DONE WHEN is "reads unmistakably as a mattress store from the sidewalk",
// which is a judgement that can only be made by looking. So: the framing a
// player actually gets, from the opposite pavement and from directly outside,
// in daylight.
//
// LIQUOR occupied EAST z -22..-35 (seams4.mjs's own run table), facade on
// x = +7.0, so the opposite pavement is x = -4.1 or so looking east.
//
//   SHOT_URL=http://localhost:4420/ node scripts/probes/w86-look-at-the-mattress-store.mjs
import { chromium } from 'playwright';
import { waitPainted, blackFraction } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL || 'http://localhost:4420/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 720 } });
const errors = [];
p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.evaluate(() => window.__ct.clock(13, 0));      // full daylight
await p.waitForTimeout(900);

const CZ = -28.5;                                       // middle of the 13 m slot
for (const [tag, x, z, tx, tz, pitch] of [
  ['across',     -4.2, CZ,        7, CZ,        0.02],
  ['across-up',  -4.2, CZ,        7, CZ,        0.16],
  ['outside',     4.6, CZ,        7, CZ,        0.06],
  ['oblique-n',   3.0, CZ + 11,   7, CZ - 1,    0.05],
  ['oblique-s',   3.0, CZ - 11,   7, CZ + 1,    0.05],
]) {
  await p.evaluate(([x, z, tx, tz, pi]) =>
    window.__ct.warp(x, z, Math.atan2(tx - x, -(tz - z)), undefined, pi), [x, z, tx, tz, pitch]);
  await waitPainted(p, { quiet: true });
  const buf = await p.screenshot({ path: `shots/w86-mattress-${tag}.png` });
  console.log(`  ${tag.padEnd(11)} black ${(await blackFraction(p, buf) * 100).toFixed(1)}%`);
}
if (errors.length) console.log('\nPAGE ERRORS:\n' + errors.join('\n'));
else console.log('\nno page errors');
await b.close();
