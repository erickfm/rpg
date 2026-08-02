// Apartment interior review — lamps, stairwell, door plates, the hermit.
//
// The interior is parked far east of the street (APT_X 200, APT_Z -20) and
// stacks four storeys over one 2D walker, so every shot has to set the floor
// height explicitly: warp(x, z, yaw, gy, pitch). Get gy wrong and the
// floor-picker drops you a storey.
//
// Camera convention (ct/fp.ts): fwd = (sin yaw, 0, -cos yaw); aiming at a
// point dx east / dz north of you is yaw = atan2(dx, -dz).
//
// Usage: SHOT_URL=http://localhost:4190/ node scripts/interior.mjs [outdir]
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4190/');
const outDir = process.argv[2] ?? 'shots/interior';
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
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });

await reportWorld(page, URL);   // GOTCHAS 26
await page.evaluate(() => { window.__ct.clock(13, 0); window.__ct.hermit(true); });
await page.waitForTimeout(700);

// [name, x, z, yaw, gy, pitch]
const SHOTS = [
  // ── ceiling lamps: hall fixtures on three floors, and a landing one ─────
  ['lamp-hall-lobby', AX(1.2), AZ(5.6), at(0, 2.1), 0, 0.62],
  ['lamp-hall-3', AX(1.2), AZ(5.6), at(0, 2.1), 3 * ST, 0.62],
  ['lamp-hall-3-under', AX(1.2), AZ(3.5), at(0, 0.1), 3 * ST, 1.15],
  ['lamp-hall-3-flat', AX(0.5), AZ(6.6), at(0.7, 3.0), 3 * ST, 0.30],
  ['lamp-landing', AX(1.2), AZ(10.2), at(0, 2.0), 1.35, 0.70],
  ['lamp-room301', AX(-1.6), AZ(4.6), at(0, -1.0), 2 * ST, 0.75],

  // ── stairwell top: the reported walk-off ────────────────────────────────
  ['stair-top-approach', AX(1.8), AZ(6.8), at(0, 2.4), 3 * ST, -0.10],
  ['stair-top-edge', AX(1.8), AZ(8.2), at(0, 2.4), 3 * ST, -0.45],
  ['stair-top-west', AX(0.6), AZ(8.0), at(0, 2.4), 3 * ST, -0.40],
  ['stair-top-down', AX(1.8), AZ(8.6), at(-0.6, 3.0), 3 * ST, -0.55],
  ['stair-top-across', AX(0.5), AZ(7.6), at(1.6, 3.4), 3 * ST, -0.25],
  ['stair-core', AX(2.0), AZ(9.4), at(-1.2, 0.4), 3 * ST, 0.10],
  ['stair-mid-up', AX(1.8), AZ(9.7), at(0, -1.6), 1.0 + 2 * ST, 0.35],
  ['stair-landing-up', AX(1.2), AZ(12.1), at(0, -2.4), 2 * ST + 1.35, 0.20],

  // ── handrail continuity: look straight at each turn, from both sides ────
  // south end of the core, where the rail wraps from one flight to the next
  ['rail-turn-landing', AX(1.2), AZ(12.2), at(0, -1.6), 1.35, -0.06],
  ['rail-turn-landing-w', AX(0.5), AZ(12.0), at(0.7, -1.4), 1.35, -0.02],
  ['rail-turn-landing-e', AX(1.9), AZ(12.0), at(-0.7, -1.4), 1.35, -0.02],
  // north end of the core, where it carries across at each floor
  ['rail-turn-floor1', AX(1.2), AZ(7.0), at(0, 1.4), ST, 0.02],
  ['rail-turn-floor2', AX(1.2), AZ(7.0), at(0, 1.4), 2 * ST, 0.02],
  ['rail-turn-floor3', AX(1.2), AZ(7.0), at(0, 1.4), 3 * ST, 0.02],
  // along the rake, going up and coming back down
  ['rail-rake-up', AX(0.55), AZ(8.9), at(0.5, 1.6), 0.35, 0.16],
  ['rail-rake-down', AX(1.85), AZ(9.4), at(-0.5, 1.2), ST + 0.7, -0.18],
  ['rail-newel', AX(0.7), AZ(7.2), at(0.4, 1.3), 0, -0.20],

  // ── the basement stair behind its gate ──────────────────────────────────
  ['cellar-approach', AX(1.2), AZ(6.0), at(0.6, 2.4), 0, -0.16],
  ['cellar-gate', AX(1.8), AZ(7.6), at(0, 0.8), 0, -0.30],
  ['cellar-down', AX(1.8), AZ(7.9), at(0, 0.5), 0, -0.62],
  ['cellar-lock', AX(1.8), AZ(7.9), at(0, 0.5), 0, -0.12],
  ['cellar-oblique', AX(0.7), AZ(7.4), at(1.1, 1.0), 0, -0.26],

  // ── door number plates ──────────────────────────────────────────────────
  // 401/301 hang on the WEST wall at AX(0.02); 102/302 on the EAST at AX(2.38)
  ['plate-401', AX(1.2), AZ(5.0), at(-1.18, -1.5), 3 * ST, 0.12],
  ['plate-401-near', AX(0.9), AZ(4.3), at(-0.88, -0.8), 3 * ST, 0.10],
  ['plate-101', AX(1.2), AZ(5.0), at(-1.18, -1.5), 0, 0.12],
  ['plate-102', AX(1.2), AZ(5.0), at(1.18, -1.5), 0, 0.12],
  ['plate-302-ajar', AX(1.2), AZ(5.0), at(1.18, -1.5), 2 * ST, 0.10],

  // ── the hermit — he stands at AX(1.95) in the hall now, not in the door ─
  ['hermit-front', AX(0.7), AZ(3.5), at(1.25, 0), 2 * ST, 0.05],
  ['hermit-near', AX(1.1), AZ(3.5), at(0.85, 0), 2 * ST, 0.05],
  ['hermit-oblique-n', AX(0.9), AZ(2.3), at(1.05, 1.2), 2 * ST, 0.05],
  ['hermit-oblique-s', AX(0.9), AZ(4.7), at(1.05, -1.2), 2 * ST, 0.05],
  ['hermit-graze-n', AX(1.9), AZ(1.5), at(0.05, 2.0), 2 * ST, 0.05],
  ['hermit-graze-s', AX(1.9), AZ(5.5), at(0.05, -2.0), 2 * ST, 0.05],
  ['hermit-far', AX(1.0), AZ(7.4), at(0.95, -3.9), 2 * ST, 0.02],
  ['hermit-past', AX(0.5), AZ(3.5), at(1.45, 0), 2 * ST, 0.30],

  // ── wall thickness, jambs, casing, and 301's door ───────────────────────
  ['door301-hall', AX(1.5), AZ(3.5), at(-1.5, 0), 2 * ST, 0.04],
  ['door301-edge', AX(0.62), AZ(5.3), at(-0.62, -1.85), 2 * ST, 0.02],
  ['door301-edge2', AX(0.62), AZ(1.7), at(-0.62, 1.85), 2 * ST, 0.02],
  ['door301-room', AX(-1.7), AZ(3.5), at(1.7, 0), 2 * ST, 0.04],
  ['door301-thru', AX(0.3), AZ(3.5), at(-0.3, 0), 2 * ST, -0.10],
  ['door302-recess', AX(1.1), AZ(5.0), at(1.3, -1.5), 2 * ST, 0.04],
  ['hall-doors-jamb', AX(1.2), AZ(6.2), at(-1.1, 2.7), 0, 0.02],

  // ── room 301, furnished ─────────────────────────────────────────────────
  ['r301-in', AX(-0.5), AZ(3.5), at(-2.2, 0), 2 * ST, 0.02],
  ['r301-window', AX(-1.4), AZ(3.75), at(-1.7, 0), 2 * ST, 0.06],
  ['r301-bed', AX(-1.5), AZ(3.4), at(-1.2, 1.5), 2 * ST, -0.18],
  ['r301-north', AX(-1.6), AZ(4.4), at(-0.6, -2.1), 2 * ST, 0.02],
  ['r301-dresser', AX(-2.2), AZ(3.6), at(-0.4, -1.2), 2 * ST, -0.10],
  ['r301-tv', AX(-1.5), AZ(3.5), at(0.0, -1.1), 2 * ST, -0.12],
  ['r301-chair', AX(-1.3), AZ(3.9), at(0.6, 0.9), 2 * ST, -0.14],
  ['r301-corner', AX(-2.7), AZ(2.9), at(1.9, 2.2), 2 * ST, 0.0],
  ['r301-ceiling', AX(-1.6), AZ(3.75), at(0, 0.5), 2 * ST, 0.95],
  ['r301-from-door', AX(-0.2), AZ(3.5), at(-2.6, 0), 2 * ST, -0.12],
];

for (const [name, x, z, yaw, gy, pitch] of SHOTS) {
  await page.evaluate(([a, b, c, d, e]) => window.__ct.warp(a, b, c, d, e), [x, z, yaw, gy, pitch]);
  await page.waitForTimeout(320);
  await page.screenshot({ path: `${outDir}/${name}.png` });
}

await browser.close();
console.log(`interior shots -> ${outDir} (${SHOTS.length} angles)`);
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
