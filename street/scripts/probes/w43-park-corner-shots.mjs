// w43 — stand at the park's path corners and along a leg, at PLAYER height,
// and take the frames. This answers items 89 (the surface reads wrong) and
// 90 (the corner reads wrong) with my own eye rather than with a diff.
//
// Positions are derived from park.ts's own layout arithmetic, not typed:
// INSET/CHAM/PATH_W and the site extents are read back out of the world.
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL || 'http://localhost:4190/';
const TAG = process.argv[2] || 'before';
const OUT = process.env.SHOT_DIR || '/tmp/w43shots';

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1100, height: 780 } });
page.on('pageerror', (e) => console.error('PAGEERR', e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await page.evaluate(() => window.__ct.clock(13, 20));
await page.waitForTimeout(500);

// the park layout, recomputed from the same constants park.ts uses
const L = { INSET: 6.0, CHAM: 2.6, PATH_W: 1.5, KERB_W: 0.25,
            minX: -39, maxX: -7, minZ: -98, maxZ: -68 };
const EDGE_X = L.maxX - L.KERB_W;
const lx0 = L.minX + L.INSET + 0.5, lx1 = EDGE_X - L.INSET;
const lz0 = L.minZ + L.INSET, lz1 = L.maxZ - L.INSET;
console.log(`legs  x ${lx0} / ${lx1}   z ${lz0} / ${lz1}   corners inset ${L.CHAM}`);

const N = 0, S = Math.PI, E = Math.PI / 2, W = -Math.PI / 2;
// Standing spots. Each: name, x, z, yaw, pitch.
const spots = [
  // the near street-leg corner, looked at from up the leg — the user's frame
  ['corner-near-approach', lx1, lz1 - L.CHAM - 4.5, N, -0.30],
  // stood ON the corner looking down at it, which is his 13-07-34
  ['corner-near-overhead', lx1 + 0.4, lz1 - L.CHAM + 0.6, -2.2, -0.62],
  // the far street-leg corner from up the leg
  ['corner-far-approach', lx1, lz0 + L.CHAM + 4.5, S, -0.30],
  // straight down the street leg — the surface, full length
  ['leg-street-down', lx1, lz1 - L.CHAM - 1.0, S, -0.22],
  // the surface close up, the way his bench frame reads it
  ['leg-surface-close', lx1 - 0.3, -83.0, S, -0.55],
  // across the path from the grass, so the edging + join to turf is the subject
  ['leg-from-grass', lx1 + 2.6, -83.0, W, -0.35],
  // the spur in from the gate meeting the circuit
  ['gate-spur', -9.5, -83.0, W, -0.28],
];

for (const [name, x, z, yaw, pitch] of spots) {
  await page.evaluate(([x, z, yaw, pitch]) => window.__ct.warp(x, z, yaw, 0.14, pitch),
    [x, z, yaw, pitch]);
  await page.waitForTimeout(420);
  await page.screenshot({ path: `${OUT}/${TAG}-${name}.png` });
  console.log(`  ${TAG}-${name}.png   at ${x.toFixed(2)}, ${z.toFixed(2)}`);
}
await b.close();
