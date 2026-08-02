// WHY DOES THE BOOT-LID -> ROOF HOP NOT GO IN? Sample it every animation frame
// from inside the page, rather than inferring it from where the player ended
// up. BUILDER-BRIEF §7: half of all apparent defects here are the instrument,
// and a hop that "failed" is exactly the shape that has fooled this project
// before (a fixed wall-clock wait truncating what it measures).
//
// Prints, per frame: feet height, z, and the frame's own dt — so a 21 mm
// margin that is real can be told apart from a push that arrived after the
// apex had passed.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w29-roof-hop.mjs
import { chromium } from 'playwright';

const EYE = 1.62;
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4188/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const cols = await p.evaluate(() => window.__ct.colliders());
const byTag = Object.fromEntries(cols.filter((c) => c.tag).map((c) => [c.tag, c]));
const boot = byTag['sedan-boot-lid'], roof = byTag['sedan-cab-roof'];
const mid = (b) => (b.minZ + b.maxZ) / 2;
const fwd = mid(roof) > mid(boot) ? 1 : -1;
const midX = (boot.minX + boot.maxX) / 2;
const yawFwd = fwd > 0 ? Math.PI : 0;

console.log(`boot  z ${boot.minZ.toFixed(3)}..${boot.maxZ.toFixed(3)} top ${boot.maxY}`);
console.log(`roof  z ${roof.minZ.toFixed(3)}..${roof.maxZ.toFixed(3)} top ${roof.maxY}`);
console.log(`the roof face the player must cross: z ${(fwd > 0 ? roof.minZ : roof.maxZ).toFixed(3)}`);
console.log(`needs feet >= ${(roof.maxY - 0.08).toFixed(3)} (maxY - TOP_EPS) to stop being a wall\n`);

// stand on the boot lid, flush against the roof
await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0), [midX, mid(boot), yawFwd]);
await p.waitForTimeout(600);
await p.keyboard.down('w'); await p.waitForTimeout(500); await p.keyboard.up('w');
await p.waitForTimeout(400);
let f = (await p.evaluate(() => window.__ct.camY())) - EYE;
let P = await p.evaluate(() => window.__ct.pos());
console.log(`flush on the boot lid: feet ${f.toFixed(3)} at z ${P[2].toFixed(3)}\n`);

// now the hop, sampled per frame
await p.keyboard.down(' ');
await p.keyboard.down('w');
const trace = await p.evaluate(() => new Promise((done) => {
  const rows = []; let last = performance.now();
  const tick = () => {
    const now = performance.now();
    rows.push([+(now - last).toFixed(1), +window.__ct.camY().toFixed(4), +window.__ct.pos()[2].toFixed(4)]);
    last = now;
    if (rows.length >= 40) return done(rows);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}));
await p.keyboard.up('w');
await p.keyboard.up(' ');

const face = fwd > 0 ? roof.minZ : roof.maxZ;
const needFeet = roof.maxY - 0.08;
let peak = -Infinity, crossed = false;
console.log('  dt(ms)   feet     z        in-roof?');
for (const [dt, cy, z] of trace) {
  const feet = cy - EYE;
  peak = Math.max(peak, feet);
  const inRoof = fwd > 0 ? z > roof.minZ : z < roof.maxZ;
  if (inRoof) crossed = true;
  console.log(`  ${String(dt).padStart(6)}  ${feet.toFixed(3)}  ${z.toFixed(3)}  ${inRoof ? 'YES' : ''}` +
    `${feet >= needFeet ? '   (high enough)' : ''}`);
}
console.log(`\npeak feet ${peak.toFixed(3)}, needed ${needFeet.toFixed(3)} — ` +
  `${peak >= needFeet ? `clears by ${((peak - needFeet) * 1000).toFixed(0)} mm` : 'TOO LOW'}`);
console.log(`crossed the roof face: ${crossed}`);
console.log(`median frame dt: ${trace.map((r) => r[0]).sort((a, b) => a - b)[Math.floor(trace.length / 2)]} ms`);
await browser.close();
