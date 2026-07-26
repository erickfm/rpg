// Builder E: evidence for the SEVENS roof sign report. The sign lives in
// ct/street.ts (D's), so this LOOKS and measures, it does not change anything.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { mkdirSync } from 'node:fs';
mkdirSync('shots/E-sign', { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 700 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4182/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, process.env.SHOT_URL ?? 'http://localhost:4182/');   // GOTCHAS 26: prove it, do not just name it
await p.evaluate(() => window.__ct.clock(13, 20));
for (const [n, x, z, yaw, pitch] of [
  ['down-the-side-street', 8.0, -103.0, Math.PI / 2, 0.20],
  ['closer', 30.0, -103.0, Math.PI / 2, 0.34],
  ['under-it', 46.0, -101.0, Math.PI / 2 - 0.5, 0.62],
  ['from-the-main-street', -2.0, -100.0, Math.PI / 2, 0.16],
]) {
  await p.evaluate(([x, z, yaw, pitch]) => window.__ct.warp(x, z, yaw, 0, pitch), [x, z, yaw, pitch]);
  await p.waitForTimeout(300);
  await p.screenshot({ path: `shots/E-sign/${n}.png` });
}
await b.close();
console.log('shots -> shots/E-sign');

// SAY SO. This script takes pictures and asserts NOTHING, and three times
// today I read a silent run of one as a pass — that is how a shelter roof
// floated 0.20 m over its posts through two rebuilds and how the mowing sat
// at 11.4% contrast after being reported fixed. GOTCHAS 24: name a script
// for what it ASSERTS. This one asserts nothing, so it says so out loud.
console.log('LOOKS ONLY — asserts nothing. Open the shots in shots/ and judge them.');
