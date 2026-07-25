import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
// Shots of the relief. The SEATS are not tested here — scripts/seats-walk.mjs
// already enumerates `__ct.seats()` and sits on every one, so the bench on the
// mound is covered by running that, not by a second probe of my own.
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1100, height: 620 } });
await page.goto('http://localhost:4194/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, 'http://localhost:4194/');
await page.evaluate(() => window.__ct.clock(13, 20));
const shot = async (n, x, z, yaw, pitch = -0.06) => {
  await page.evaluate(([x, z, yaw, p]) => window.__ct.warp(x, z, yaw, 0.14, p), [x, z, yaw, pitch]);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `shots/E-mound/${n}.png` });
};
// Framed so the FIELD fills the shot. The first set was framed on the park and
// the mound was four pixels of it — a mound 0.31 m high, seen from the gate 20 m
// away at eye height, is geometrically a sliver. These stand on the loop and
// look across the grass, which is where a player is when the relief is worth
// anything.
await shot('a-north-end-looking-over-it', -23.6, -73.4, 0.0, -0.05);
await shot('b-back-path-along-the-crest', -32.6, -84.6, Math.PI / 2, -0.04);
await shot('c-street-leg-across', -13.2, -84.6, -Math.PI / 2, -0.04);
await shot('d-the-dish-from-the-corner', -14.6, -74.6, -2.4, -0.10);
await shot('e-south-end-corner-fall', -23.6, -92.6, Math.PI, -0.06);
await shot('f-on-the-crest', -21.0, -84.6, -Math.PI / 2, -0.04);
await b.close();
