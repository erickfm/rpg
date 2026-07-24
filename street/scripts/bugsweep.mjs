// Diligent graphical-bug sweep: walk the whole world, many angles.
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message)));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await page.waitForTimeout(700);

const shots = [];
const shot = async (name, fn, wait = 320) => {
  await page.evaluate(fn);
  await page.waitForTimeout(wait);
  const p = `shots/bug-${name}.png`;
  await page.screenshot({ path: p });
  shots.push(p);
};

// daytime, clear (find a non-rainy hour = noon-ish; 12 → hash check)
await page.evaluate(() => window.__ct.clock(13, 0));

// ── walk the main street, both directions ───────────────────────────────
await shot('street-spawn', () => window.__ct.warp(0, 8, Math.PI, 0, 0));          // looking down the street from spawn
await shot('street-north', () => window.__ct.warp(-1, -20, 0, 0, 0.02));          // looking back north
await shot('street-mid-w', () => window.__ct.warp(2, -25, -Math.PI/2, 0, 0));     // west facades
await shot('street-mid-e', () => window.__ct.warp(-2, -25, Math.PI/2, 0, 0));     // east facades
await shot('street-mid-w2', () => window.__ct.warp(2, -55, -Math.PI/2, 0, 0));
await shot('street-mid-e2', () => window.__ct.warp(-2, -55, Math.PI/2, 0, 0));
await shot('street-far-w', () => window.__ct.warp(2, -80, -Math.PI/2, 0, 0));
await shot('street-far-e', () => window.__ct.warp(-2, -80, Math.PI/2, 0, 0));
await shot('street-down', () => window.__ct.warp(-1, -10, Math.PI, 0, 0));        // down the length
await shot('street-updown', () => window.__ct.warp(-1, -70, 0, 0, 0));            // up the length

// ── trees & sidewalk grid (walkability/fitting) ─────────────────────────
await shot('tree-w1', () => window.__ct.warp(4.5, -18, -Math.PI/2, 0, 0.1));
await shot('tree-e1', () => window.__ct.warp(-4.5, -30, Math.PI/2, 0, 0.1));
await shot('tree-look-up', () => window.__ct.warp(5.2, -18, -Math.PI/2, 0, 0.5));
await shot('tree-look-down', () => window.__ct.warp(5.2, -18, -Math.PI/2, 0, -0.6)); // pit grid
await shot('walk-grid-w', () => window.__ct.warp(4.8, -40, Math.PI, 0, -0.7));    // sidewalk slabs down
await shot('walk-grid-e', () => window.__ct.warp(-4.8, -40, Math.PI, 0, -0.7));

// ── the pickup ──────────────────────────────────────────────────────────
await shot('pickup-side', () => window.__ct.warp(-0.6, -34, -Math.PI/2, 0, 0));
await shot('pickup-rear', () => window.__ct.warp(-1.6, -37.6, Math.atan2(-2.3,-3.6), 0, 0));
await shot('pickup-bed', () => window.__ct.warp(-1.8, -36.8, Math.atan2(-2.1,-2.8), 0, -0.25));
await shot('pickup-front', () => window.__ct.warp(-1.6, -30, Math.atan2(-1,-4), 0, 0));

// ── the alley ───────────────────────────────────────────────────────────
await shot('alley-in', () => window.__ct.warp(-9.5, -40.2, Math.atan2(-3,0.5), 0, 0.1));
await shot('alley-dumpster', () => window.__ct.warp(-9.0, -40.2, Math.atan2(-2.2,-2.0), 0, 0));
await shot('alley-cat', () => window.__ct.warp(-9.2, -41.5, Math.atan2(-1.3,1.2), 0, -0.2));
await shot('alley-graffiti', () => window.__ct.warp(-9.5, -38, Math.atan2(-2,0.3), 0, 0.15));
await shot('alley-up', () => window.__ct.warp(-10, -40, -Math.PI/2, 0, 0.6));     // sky gaps?

// ── the corner / side street ────────────────────────────────────────────
await shot('corner-approach', () => window.__ct.warp(-1, -85, Math.PI+0.15, 0, 0));
await shot('corner-road', () => window.__ct.warp(-1, -93, Math.PI, 0, -0.5));     // road seam
await shot('corner-east', () => window.__ct.warp(1.5, -101, Math.PI/2, 0, 0));
await shot('corner-north', () => window.__ct.warp(3, -99, 0.2, 0, 0));            // north shops
await shot('corner-south', () => window.__ct.warp(3, -99, Math.PI-0.2, 0, 0));    // south shops
await shot('corner-far-east', () => window.__ct.warp(20, -99, Math.PI/2, 0, 0));  // fog end
await shot('corner-bodega', () => window.__ct.warp(4.5, -102.5, Math.atan2(4.2,5.5), 0, 0));

// ── bodega interior ─────────────────────────────────────────────────────
await shot('bodega-in', () => window.__ct.warp(241.3, -17, Math.PI/2, 0, 0));
await shot('bodega-counter', () => window.__ct.warp(244.5, -14.5, Math.atan2(-2.3,3.5), 0, 0));
await shot('bodega-shelves', () => window.__ct.warp(241.3, -17, -Math.PI/2, 0, 0));

// ── the whitmore entrance ───────────────────────────────────────────────
await shot('whitmore', () => window.__ct.warp(4.6, -42.6, Math.atan2(2.3,1.4), 0.14, 0));
await shot('whitmore-door', () => window.__ct.warp(3.2, -44, Math.atan2(4,0), 0.14, 0.1));

// ── apartment lobby + stairs + hermit floor + room ──────────────────────
await shot('lobby', () => window.__ct.warp(201.2, -18.5, Math.PI, 0, 0));
await shot('stairs-up', () => window.__ct.warp(200.6, -10.5, Math.PI, 0.6, 0.35));
await shot('stairs-down', () => { window.__ct.warp(200.6, -14, 0, 5.4, -0.4); });
await shot('hall3', () => { window.__ct.hermit(true); window.__ct.warp(200.6, -18.2, Math.PI*0.9, 5.4, 0); });
await shot('hermit', () => window.__ct.warp(201.0, -16.0, Math.atan2(1.3,0.1), 5.4, 0));
await shot('room301', () => window.__ct.warp(199.6, -16.5, Math.atan2(-2.5,1.2), 5.4, 0));

// ── people (citizen billboards up close) ────────────────────────────────
await shot('citizen', () => window.__ct.warp(-1, -22, Math.PI, 0, 0));

// ── night + rain ────────────────────────────────────────────────────────
await shot('night-street', () => { window.__ct.clock(23, 0); window.__ct.warp(-1, -30, Math.PI, 0, 0.05); });
await shot('night-corner', () => { window.__ct.clock(23, 30); window.__ct.warp(-1, -90, Math.PI, 0, 0); });
const rainy = await page.evaluate(() => { for (let h=0;h<300;h++){ if(((Math.imul(h,2246822519)>>>0)%100)<22) return h; } return -1; });
await page.evaluate((h) => window.__ct.clock(h, 30), rainy);
await shot('rain', () => window.__ct.warp(-1.4, -20, Math.PI, 0, 0.1), 2500);
await shot('rain-indoor', () => window.__ct.warp(241.3, -17, Math.PI/2, 0, 0), 900); // must be dry

await browser.close();
console.log('bugsweep done. rainy hour', rainy, '\nshots:', shots.length);
if (errors.length) { console.error('CONSOLE/PAGE ISSUES:\n' + errors.join('\n')); }
else console.log('no console/page errors');
