// Walk No. 227 end to end, in the order a player actually meets it: the
// street, the stoop, the lobby, every flight and landing, the hermit's floor,
// 301, the top landing, and back down the shaft.
//
// This is a QUALITY PASS script, not a regression script — it exists to be
// looked at. Floors are explicit because the walk-up stacks four storeys over
// one 2D walker and warp() has to be told which one you are on:
//   lobby 0 · landing 1.35 · 101/102 2.7 · landing 4.05 · 301/302 5.4
//   landing 6.75 · 401/402 8.1
//
// Usage: SHOT_URL=http://localhost:4190/ node scripts/walkup.mjs [outdir]
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4190/');
const outDir = process.argv[2] ?? 'shots/walkup';
mkdirSync(outDir, { recursive: true });

const AX = (lx) => 200 + lx, AZ = (lz) => -20 + lz;
const ST = 2.7;
const at = (dx, dz) => Math.atan2(dx, -dz);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });

await reportWorld(page, URL);   // GOTCHAS 26
await page.evaluate(() => { window.__ct.clock(13, 0); window.__ct.hermit(true); });
await page.waitForTimeout(700);

// [name, x, z, yaw, gy, pitch]
const WALK = [
  // ── outside ────────────────────────────────────────────────────────────
  ['01-approach',      3.0, -47.0, at(3.6, 3.0), 0.14, 0.04],
  ['02-facade',        3.2, -44.0, at(3.8, 0),   0.14, 0.10],
  ['03-stoop',         6.0, -44.0, at(1.0, 0),   0.14, -0.62],
  ['04-stoop-oblique', 5.8, -42.6, at(1.2, -1.4), 0.14, -0.42],
  ['05-door',          5.9, -44.0, at(1.1, 0),   0.14, 0.04],
  ['06-transom',       6.1, -44.0, at(0.9, 0),   0.14, 0.52],

  // ── lobby ──────────────────────────────────────────────────────────────
  ['07-lobby-arrive',  AX(1.2), AZ(1.5), at(0, 2.4), 0, 0.02],
  ['08-lobby-back',    AX(1.2), AZ(2.2), at(0, -2.2), 0, 0.04],
  ['09-mailboxes',     AX(1.2), AZ(1.3), at(1.2, 0), 0, 0.04],
  ['10-lobby-shaft',   AX(1.2), AZ(6.0), at(0, 2.6), 0, -0.02],
  ['11-cellar-gate',   AX(1.8), AZ(7.4), at(0, 1.1), 0, -0.26],
  ['12-cellar-down',   AX(1.8), AZ(7.9), at(0, 0.5), 0, -0.60],
  ['13-newel',         AX(0.9), AZ(7.6), at(0.2, 1.0), 0, -0.28],

  // ── up flight A ────────────────────────────────────────────────────────
  ['14-flightA-foot',  AX(0.6), AZ(8.0), at(0, 2.0), 0,    0.10],
  ['15-flightA-mid',   AX(0.6), AZ(9.4), at(0, 1.4), 0.62, 0.12],
  ['16-flightA-head',  AX(0.6), AZ(10.3), at(0, 1.2), 1.16, 0.04],
  ['17-landing1',      AX(1.2), AZ(11.9), at(0, -1.6), 1.35, 0.02],
  ['18-landing1-turn', AX(1.5), AZ(11.4), at(0.4, -2.0), 1.35, 0.06],

  // ── up flight B ────────────────────────────────────────────────────────
  ['19-flightB-foot',  AX(1.8), AZ(10.3), at(0, -1.4), 1.50, 0.10],
  ['20-flightB-mid',   AX(1.8), AZ(9.4), at(0, -1.2), 2.05, 0.08],
  ['21-floor1-arrive', AX(1.8), AZ(8.2), at(-0.6, -2.2), ST, 0.00],

  // ── floor 1: 101 / 102 ─────────────────────────────────────────────────
  ['22-floor1-hall',   AX(1.2), AZ(6.0), at(0, -2.4), ST, 0.02],
  ['23-door-201',      AX(1.2), AZ(5.0), at(-1.18, -1.5), ST, 0.12],
  ['24-door-202',      AX(1.2), AZ(5.0), at(1.18, -1.5), ST, 0.12],

  // ── floor 2: the hermit, and 301 ───────────────────────────────────────
  ['25-floor2-arrive', AX(1.8), AZ(8.0), at(-0.6, -3.0), 2 * ST, 0.00],
  ['26-hermit',        AX(0.7), AZ(3.5), at(1.25, 0), 2 * ST, 0.05],
  ['27-hermit-past',   AX(0.5), AZ(2.4), at(1.45, 1.1), 2 * ST, 0.05],
  ['28-hermit-face',   AX(1.1), AZ(3.5), at(0.85, 0), 2 * ST, 0.12],
  ['29-door-301',      AX(1.5), AZ(3.5), at(-1.5, 0), 2 * ST, 0.04],
  ['30-301-jamb',      AX(0.62), AZ(5.3), at(-0.62, -1.85), 2 * ST, 0.02],

  // ── inside 301 ─────────────────────────────────────────────────────────
  ['31-301-enter',     AX(-0.5), AZ(3.5), at(-2.2, 0), 2 * ST, 0.02],
  ['32-301-window',    AX(-1.5), AZ(3.75), at(-1.6, 0), 2 * ST, 0.06],
  ['33-301-bed',       AX(-1.5), AZ(3.4), at(-1.2, 1.5), 2 * ST, -0.18],
  ['34-301-north',     AX(-1.6), AZ(4.3), at(-0.6, -2.0), 2 * ST, 0.02],
  ['35-301-back',      AX(-2.6), AZ(3.0), at(2.2, 1.9), 2 * ST, 0.00],
  ['36-301-floor',     AX(-1.6), AZ(3.6), at(-0.8, 0), 2 * ST, -0.70],

  // ── on up to the top ───────────────────────────────────────────────────
  ['37-floor3-arrive', AX(1.8), AZ(8.0), at(-0.6, -3.0), 3 * ST, 0.00],
  ['38-top-landing',   AX(0.6), AZ(8.8), at(0, 1.0), 3 * ST, -0.10],
  ['39-top-rail',      AX(0.6), AZ(8.7), at(0.1, 1.2), 3 * ST, -0.34],
  ['40-top-over',      AX(0.6), AZ(9.3), at(0.2, 0.5), 3 * ST, -0.72],
  ['41-top-core',      AX(0.5), AZ(8.6), at(1.4, 1.2), 3 * ST, 0.06],
  ['42-door-401',      AX(1.2), AZ(5.0), at(-1.18, -1.5), 3 * ST, 0.12],

  // ── back down ──────────────────────────────────────────────────────────
  ['43-down-look',     AX(1.8), AZ(8.6), at(-0.5, 2.6), 3 * ST, -0.52],
  ['44-down-mid',      AX(1.8), AZ(9.6), at(0, 1.4), 3 * ST - 0.62, -0.30],
  ['45-shaft-up',      AX(1.2), AZ(11.9), at(0, -2.0), 2 * ST + 1.35, 0.82],
  ['46-shaft-down',    AX(1.2), AZ(11.9), at(0, -2.0), 2 * ST + 1.35, -0.80],
];

for (const [name, x, z, yaw, gy, pitch] of WALK) {
  await page.evaluate(([a, b, c, d, e]) => window.__ct.warp(a, b, c, d, e), [x, z, yaw, gy, pitch]);
  await page.waitForTimeout(320);
  await page.screenshot({ path: `${outDir}/${name}.png` });
}

await browser.close();
console.log(`walk-up walkthrough -> ${outDir} (${WALK.length} stops)`);
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
