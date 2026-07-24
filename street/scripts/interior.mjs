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
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4190/';
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

  // ── door number plates ──────────────────────────────────────────────────
  // 401/301 hang on the WEST wall at AX(0.02); 102/302 on the EAST at AX(2.38)
  ['plate-401', AX(1.2), AZ(5.0), at(-1.18, -1.5), 3 * ST, 0.12],
  ['plate-401-near', AX(0.9), AZ(4.3), at(-0.88, -0.8), 3 * ST, 0.10],
  ['plate-101', AX(1.2), AZ(5.0), at(-1.18, -1.5), 0, 0.12],
  ['plate-102', AX(1.2), AZ(5.0), at(1.18, -1.5), 0, 0.12],
  ['plate-302-ajar', AX(1.2), AZ(5.0), at(1.18, -1.5), 2 * ST, 0.10],

  // ── the hermit, from every side ─────────────────────────────────────────
  ['hermit-front', AX(0.9), AZ(3.5), at(1.4, 0), 2 * ST, 0.05],
  ['hermit-near', AX(1.5), AZ(3.5), at(0.8, 0), 2 * ST, 0.05],
  ['hermit-oblique-n', AX(1.1), AZ(2.2), at(1.2, 1.3), 2 * ST, 0.05],
  ['hermit-oblique-s', AX(1.1), AZ(4.8), at(1.2, -1.3), 2 * ST, 0.05],
  ['hermit-graze-n', AX(2.0), AZ(1.4), at(0.3, 2.1), 2 * ST, 0.05],
  ['hermit-graze-s', AX(2.0), AZ(5.6), at(0.3, -2.1), 2 * ST, 0.05],
  ['hermit-far', AX(1.2), AZ(7.6), at(1.1, -4.1), 2 * ST, 0.02],
];

for (const [name, x, z, yaw, gy, pitch] of SHOTS) {
  await page.evaluate(([a, b, c, d, e]) => window.__ct.warp(a, b, c, d, e), [x, z, yaw, gy, pitch]);
  await page.waitForTimeout(320);
  await page.screenshot({ path: `${outDir}/${name}.png` });
}

await browser.close();
console.log(`interior shots -> ${outDir} (${SHOTS.length} angles)`);
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
