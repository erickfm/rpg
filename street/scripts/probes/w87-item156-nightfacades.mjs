// ITEM 156 — REPRODUCE FIRST. "whats going on here with the light reflecting
// against the invisible wall?" (night).
//
// The item is explicit: find the wall in HIS frame before generalising. So this
// walks the pavement at 23:00 and photographs the facade on each side at a
// series of z, which is the sweep the routine one does not do — bugsweep's
// street stations all shoot at the default clock.
//
// waitPainted, not a fixed sleep: the pool is a shader uniform uploaded per
// frame and a frame taken before the first paint shows no lamplight at all,
// which would read as the artifact being absent (GOTCHAS 78/80).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { waitPainted } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL || 'http://localhost:4430/';
const HOUR = Number(process.env.HOUR ?? 23);
mkdirSync('shots', { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
const errors = [];
p.on('pageerror', (e) => errors.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await waitPainted(p);
await p.evaluate((h) => window.__ct.clock(h, 0), HOUR);
await p.waitForTimeout(900);

for (const z of [4, -8, -20, -30, -40, -50, -60, -72]) {
  for (const [side, x, yaw] of [['w', 2.0, -Math.PI / 2], ['e', -2.0, Math.PI / 2]]) {
    await p.evaluate(([X, Z, Y]) => window.__ct.warp(X, Z, Y, 0, 0.08), [x, z, yaw]);
    await p.waitForTimeout(260);
    await waitPainted(p);
    const f = `shots/w87-156-n${HOUR}-z${String(z).replace('-', 'm')}-${side}.png`;
    await p.screenshot({ path: f });
    console.log(`  ${f}`);
  }
}
console.log(`console errors: ${errors.length}`);
await b.close();
