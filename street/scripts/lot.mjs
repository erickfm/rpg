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
  ['11-price-card',     8.3,  4.4, at(1.5, 1.0),   0.02],
  ['12-office',        10.0, 13.0, at(1.6, -2.2),  0.06],
  ['13-office-window',  9.4, 11.6, at(1.9, -0.6),  0.04],
  ['14-floodlight',    12.0, -4.0, at(2.4, 3.0),   0.52],
  ['15-back-fence',    12.0,  2.0, at(3.4, 0),     0.02],
  ['16-lot-to-street', 13.0,  4.0, at(-6.0, 0),    0.04],
  ['17-asphalt',        9.5,  5.0, at(1.0, 0),    -0.72],
  ['18-down-the-walk',  6.1, 16.0, at(0.2, -14.0), 0.02],
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
