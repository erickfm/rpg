// The used car lot, from the street and from inside it.
//
// The lot is on the EAST side, so you look at it from the west: yaw is
// atan2(dx, -dz) toward a point dx east / dz north of you. It is the loudest
// thing on the block by design, so several of these are deliberately taken
// from far enough away to see it against its neighbours — that contrast, and
// the one with E's park at the other end, is the point of it.
//
// Usage: SHOT_URL=http://localhost:4190/ node scripts/lot.mjs [outdir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4190/';
const outDir = process.argv[2] ?? 'shots/lot';
mkdirSync(outDir, { recursive: true });
const at = (dx, dz) => Math.atan2(dx, -dz);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await page.evaluate(() => window.__ct.clock(13, 0));
await page.waitForTimeout(700);

// [name, x, z, yaw, pitch]  — all at walk height on the west side
const SHOTS = [
  ['01-from-across',   -4.0,  2.0, at(11.0, 0),    0.06],
  ['02-frontage-n',    -3.0, 12.0, at(10.0, -6.0), 0.04],
  ['03-frontage-s',    -3.0, -8.0, at(10.0, 8.0),  0.04],
  ['04-bunting',        2.0,  6.0, at(5.0, 0),     0.34],
  ['05-bunting-up',     5.0,  4.0, at(2.0, 0),     0.62],
  ['06-gate',           4.6, 11.6, at(2.6, -1.0),  0.02],
  ['07-pole-sign',      3.0,  6.5, at(4.0, 1.5),   0.46],
  ['08-banners',        5.4,  0.0, at(1.8, 2.0),   0.06],
  ['09-in-the-gate',    7.6, 11.0, at(2.0, -3.0), -0.02],
  ['10-stock-row',     11.6, 11.4, at(1.4, -7.0), -0.04],
  ['11-price-soap',     7.3,  7.8, at(2.6, 1.4),   0.02],
  ['11b-price-burst',   7.3,  4.5, at(2.6, 1.4),   0.02],
  ['11c-price-sold',   10.8,  6.4, at(2.6, 1.4),   0.02],
  ['11d-price-row',     7.0, 11.0, at(3.4, -1.0),  0.00],
  ['12-office',        10.0, 13.0, at(1.6, -2.2),  0.06],
  ['13-office-window',  9.4, 11.6, at(1.9, -0.6),  0.04],
  ['14-floodlight',    12.0, -4.0, at(2.4, 3.0),   0.52],
  ['15-back-wall',     11.0,  2.0, at(3.8, 0),     0.06],
  ['16-lot-to-street', 13.0,  4.0, at(-6.0, 0),    0.04],
  ['17-asphalt',       11.6,  6.5, at(1.2, -2.0), -0.80],
  ['18-down-the-walk',  6.1, 16.0, at(0.2, -14.0), 0.02],
  ['22-sandwich',       7.7,  4.84, at(1.0, 0),     -0.16],
  ['23-tyres',         12.4, 10.0, at(1.6, 1.6),    -0.16],
  ['24-hose',          10.6, 12.4, at(1.2, -0.8),   -0.30],
  ['25-back-of-lot',   22.0, -4.0, at(-6.0, 6.0),    0.02],
  ['26-depth-from-gate', 8.0,  4.0, at(14.0, 0),      0.00],
  ['27-depth-oblique',   9.0, 12.0, at(12.0, -12.0),  0.00],
  ['28-rows-recede',     7.6,  8.0, at(15.0, -3.0),  -0.02],
  ['29-gate-roller',     4.6,  8.6, at(3.4, -0.6),    0.02],
  ['30-gate-chain',      6.2,  7.6, at(1.4, 0.2),    -0.12],
  ['31-aisle',           9.6,  6.0, at(0.4, 8.0),    -0.04],
  ['32-empty-bay',       7.4,  6.0, at(3.0, 2.4),    -0.14],
  ['33-buyers-guide',    8.4,  9.2, at(1.5, -0.5),    0.00],
  ['34-guide-close',     8.0,  6.9, at(1.3, -0.2),   -0.02],
  ['35-balloons',        9.0, 10.6, at(1.6, -2.6),    0.30],
  ['36-banner-sag',      6.4,  2.0, at(1.2,  2.6),    0.10],
  ['37-pole-full',      -6.0,  6.5, at(13.0, 0),      0.52],
  ['38-aisle-look',     14.0,  6.0, at(-6.0, 5.0),   -0.02],
  ['39-chairs',         12.4,  5.4, at(0.2,  2.4),   -0.10],
  ['40-chairs-close',   12.6,  6.6, at(0.0,  1.4),   -0.22],
  ['41-tyre-seat',      27.2, 11.6, at(1.4,  0.0),   -0.16],
];

for (const [name, x, z, yaw, pitch] of SHOTS) {
  await page.evaluate(([a, b, c, d]) => window.__ct.warp(a, b, c, 0.14, d), [x, z, yaw, pitch]);
  await page.waitForTimeout(320);
  await page.screenshot({ path: `${outDir}/${name}.png` });
}

// and after dark, for the floodlight
await page.evaluate(() => window.__ct.clock(22, 30));
await page.waitForTimeout(900);
for (const [name, x, z, yaw, pitch] of [
  ['19-night-front', -3.0, 4.0, at(10.0, 0), 0.10],
  ['20-night-flood', 10.5, -2.6, at(4.3, -4.0), 0.30],
  ['21-night-pool', 9.0, 4.0, at(3.5, -9.0), -0.34],
]) {
  await page.evaluate(([a, b, c, d]) => window.__ct.warp(a, b, c, 0.14, d), [x, z, yaw, pitch]);
  await page.waitForTimeout(420);
  await page.screenshot({ path: `${outDir}/${name}.png` });
}

await browser.close();
console.log(`lot -> ${outDir} (${SHOTS.length + 3} shots)`);
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
