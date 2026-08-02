// LOOK at the pickup side-on, because item 69 took 85 mm out of its cab roof
// and "does the truck still read as a truck" is a judgement no assertion makes
// for you (BUILDER-BRIEF §12.2). This is for LOOKING, never for proving: two
// runs of identical code differ ~20% of pixels.
//
// Usage: SHOT_URL=http://localhost:4185/ node scripts/probes/w33-pickup-profile.mjs
import { chromium } from 'playwright';

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1100, height: 620 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4185/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.evaluate(() => window.__ct.clock(11, 0));

const cols = await p.evaluate(() => window.__ct.colliders());
const byTag = Object.fromEntries(cols.filter((c) => c.tag).map((c) => [c.tag, c]));
const bed = byTag['pickup-bed-floor'], roof = byTag['pickup-cab-roof'];
const midZ = (bed.minZ + bed.maxZ) / 2;
const midX = (bed.minX + bed.maxX) / 2;
console.log(`roof top ${roof.maxY}, rail top ${byTag['pickup-rail-left'].maxY}, hood ${byTag['pickup-hood'].maxY}`);

// stand off the truck's +x flank, facing -x (forward is (sin y, -cos y))
await p.evaluate(([x, z]) => window.__ct.warp(x, z, -Math.PI / 2, undefined, 0), [midX + 6.5, midZ]);
// YOU SPAWN IN ROOM 301, THREE STOREYS UP, and `warp` writes x and z but not
// your height — ct/apartment.ts's storey picker walks down to the street over
// several frames rather than snapping. Shoot before it settles and you get a
// black frame from inside the building, which is exactly what the first run of
// this probe produced. Same trap w21-roof-climb.mjs documents at its start.
await p.evaluate(() => new Promise((done) => {
  let last = NaN, still = 0, n = 0;
  const tick = () => {
    const y = window.__ct.camY();
    still = Math.abs(y - last) < 1e-4 ? still + 1 : 0;
    last = y;
    if (still >= 8 || ++n > 400) return done(y);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}));
await p.evaluate(() => window.__ct.clock(11, 0));
await p.waitForTimeout(700);
console.log('feet after settle:', (await p.evaluate(() => window.__ct.camY())) - 1.62);
await p.screenshot({ path: 'shots/w33-pickup-side.png' });
console.log('wrote shots/w33-pickup-side.png');
await browser.close();
