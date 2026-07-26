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
// ── IS THERE ACTUALLY ANY TOPOGRAPHY, AND IS IT GENTLE? ──────────────────────
//
// The queue item is the user's own words - "i was hoping to get some
// topographical changes" - and the brief adds a constraint pulling the other
// way: "Keep it GENTLE: this is a 2D walker and the floor comes from a picker,
// so anything you can trip over is a bug." The relief has to be big enough to
// see and shallow enough to walk, and this file took six photographs and
// asserted neither. Same shape as the shelter roof floating over its posts.
//
// Both are measurable off the world's own picker - the same function the mesh
// was built from and the same one the player's feet use.
const relief = await page.evaluate(() => {
  const X0 = -32, X1 = -14, Z0 = -91, Z1 = -75, STEP = 0.4;
  const g = [];
  for (let x = X0; x <= X1; x += STEP) {
    const row = [];
    for (let z = Z0; z <= Z1; z += STEP) row.push(window.__ct.groundAt(x, z));
    g.push(row);
  }
  return { g, STEP, X0, Z0 };
});
const G = relief.g, ST = relief.STEP;
const flatv = G.flat();
if (flatv.length < 400 || flatv.some((v) => typeof v !== 'number')) {
  console.log(`EXIT 3: ${flatv.length} usable ground samples - the picker did not answer`);
  await b.close(); process.exit(3);
}
const lo = Math.min(...flatv), hi = Math.max(...flatv);
let worst = 0, wx = 0, wz = 0;
for (let i = 0; i < G.length; i++) {
  for (let j = 0; j < G[i].length; j++) {
    for (const [di, dj] of [[1, 0], [0, 1]]) {
      const a = G[i]?.[j], c = G[i + di]?.[j + dj];
      if (a === undefined || c === undefined) continue;
      const grad = Math.abs(c - a) / ST;
      if (grad > worst) { worst = grad; wx = relief.X0 + i * ST; wz = relief.Z0 + j * ST; }
    }
  }
}
await b.close();
console.log(`field relief over ${flatv.length} samples on a ${ST} m grid`);
console.log(`  height     ${lo.toFixed(2)} to ${hi.toFixed(2)} m - a range of ${(hi - lo).toFixed(2)} m`);
console.log(`  steepest   1 in ${worst ? (1 / worst).toFixed(1) : 'inf'} at ${wx.toFixed(1)},${wz.toFixed(1)}`);
const fails = [];
// PERCEPTIBLE: at ~8 px/m a rise under about 15 cm across a whole field is not
// ground that rises, it is a flat plane with a rounding error.
if (hi - lo < 0.15) fails.push(`FLAT: ${(hi - lo).toFixed(2)} m across the whole field - the user asked for topographical change and would not see this`);
// GENTLE: the brief's own word. 1 in 5 is a bank you feel underfoot in a
// walker with no step-up; 1 in 8 reads as a slope and walks as a floor.
if (worst > 0.20) fails.push(`STEEP: 1 in ${(1 / worst).toFixed(1)} at ${wx.toFixed(1)},${wz.toFixed(1)} - the brief says keep it gentle`);
for (const f of fails) console.log('FAIL ', f);
if (!fails.length) console.log(`PASS  ${(hi - lo).toFixed(2)} m of relief, nowhere steeper than 1 in ${(1 / worst).toFixed(1)}`);
process.exit(fails.length ? 1 : 0);
