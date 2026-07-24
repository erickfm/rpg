// Seam audit sweep — read-only. Drives __ct.warp/__ct.clock and shoots every
// junction in the world from at least two angles, one of them grazing.
//
//   SHOT_URL=http://localhost:4182/ node scripts/seams.mjs [groupPrefix ...]
//
// Shots land in street/shots/seam-<label>.png.  Camera convention (fp.ts):
// fwd = (sin yaw, 0, -cos yaw), so to look from (x,z) at (tx,tz):
//   yaw = atan2(tx - x, -(tz - z))
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const look = (x, z, tx, tz) => Math.atan2(tx - x, -(tz - z));

// label, x, z, yaw, groundY, pitch, hour(optional [h,m])
const SHOTS = [
  // ── A. the bodega corner: the known defect, all round it ─────────────────
  ['A-bodega-corner-eye',   3.5, -100.5, look(3.5, -100.5, 8, -95),   0, 0.15],
  ['A-bodega-corner-close', 5.6, -98.6,  look(5.6, -98.6, 8.4, -95.6), 0, 0.35],
  ['A-bodega-corner-up',    5.6, -98.6,  look(5.6, -98.6, 8.4, -95.6), 0, 0.85],
  ['A-bodega-graze-main',   6.6, -88,    look(6.6, -88, 6.95, -96),   0.14, 0.05],
  ['A-bodega-graze-main-lo',6.6, -88,    look(6.6, -88, 6.95, -96),   0.14, -0.35],
  ['A-bodega-graze-side',   14,  -96.9,  look(14, -96.9, 8.1, -96.05), 0.14, 0.05],
  ['A-bodega-bay-front',    6.2, -97.6,  look(6.2, -97.6, 7.9, -95.9), 0, 0.1],
  ['A-bodega-gap-triangle', 7.9, -95.0,  look(7.9, -95.0, 7.2, -95.9), 0.14, -1.1],
  ['A-bodega-crates',       6.4, -98.6,  look(6.4, -98.6, 8.6, -96.6), 0, -0.2],
  ['A-bodega-pier-graze',   10.5,-97.4,  look(10.5, -97.4, 8.2, -96.0), 0.14, 0.2],
  ['A-bodega-wing-join',    12,  -99.5,  look(12, -99.5, 10.4, -96),  0, 0.3],
  ['A-bodega-roofcap',      4.0, -101,   look(4.0, -101, 8.4, -95.5), 0, 0.9],

  // ── B. ground: road / gutter / kerb / walk / corner ──────────────────────
  ['B-kerb-graze-east',     4.3, -10,    look(4.3, -10, 5.15, -60),   0, -0.22],
  ['B-kerb-graze-east-lo',  4.55,-10,    look(4.55, -10, 5.05, -60),  0, -0.10],
  ['B-kerb-graze-west',    -4.3, -60,    look(-4.3, -60, -5.15, -10), 0, -0.22],
  ['B-kerb-front',          4.3, -30,    look(4.3, -30, 5.4, -30),    0, -0.55],
  ['B-gutter-close',        4.2, -30,    look(4.2, -30, 5.2, -31.5),  0, -0.85],
  ['B-walk-kerb-top',       5.6, -30,    look(5.6, -30, 5.0, -30),    0.14, -1.0],
  ['B-catch-basin',         3.9, -92.5,  look(3.9, -92.5, 5.1, -92.5), 0, -0.5],
  ['B-catch-basin-graze',   4.6, -88,    look(4.6, -88, 4.85, -93),   0, -0.28],
  ['B-kerb-ramp',           6.3, -97.2,  look(6.3, -97.2, 4.6, -98.6), 0.10, -0.5],
  ['B-kerb-ramp-graze',     8.0, -97.0,  look(8.0, -97.0, 5.2, -98.4), 0.14, -0.20],
  ['B-corner-fan',          3.0, -101.5, look(3.0, -101.5, 6.5, -96.5), 0, -0.35],
  ['B-road-seam-98',        0,   -93,    look(0, -93, 0, -103),        0, -0.55],
  ['B-road-seam-98-graze',  0,   -95,    look(0, -95, 3, -99.5),       0, -0.18],
  ['B-sw-inside-bend',     -3.2, -103,   look(-3.2, -103, -5.6, -107.6), 0, -0.4],
  ['B-se-end-bend',        50,   -103,   look(50, -103, 55.5, -104),  0, -0.3],
  ['B-side-centreline',    12,   -103,   look(12, -103, 45, -103),    0, -0.25],
  ['B-tree-pit',            4.2, -4,     look(4.2, -4, 5.4, -1.5),    0, -0.45],
  ['B-tree-pit-graze',      5.4, -6,     look(5.4, -6, 5.4, -1.5),    0.14, -0.30],
  ['B-walk-slab-graze',     6.4, -20,    look(6.4, -20, 6.4, -70),    0.14, -0.28],
  ['B-walk-corner-slabs',   6.4, -94,    look(6.4, -94, 7.4, -96.5),  0.14, -0.8],
  ['B-side-walk-north',    20,   -97.0,  look(20, -97.0, 9, -97.0),   0.14, -0.25],
  ['B-side-walk-south',    20,   -109,   look(20, -109, 50, -109),    0.14, -0.25],

  // ── C. building-to-building vertical joins, both streets ─────────────────
  ['C-west-joins-north',    3.0, -8.8,   look(3.0, -8.8, -7, -8.8),   0, 0.25],
  ['C-west-joins-graze',    -6.3, 2,     look(-6.3, 2, -6.9, -60),    0.14, 0.20],
  ['C-west-joins-graze-up', -6.3, 2,     look(-6.3, 2, -6.9, -60),    0.14, 0.75],
  ['C-east-joins-graze',    6.3, -2,     look(6.3, -2, 6.9, -60),     0.14, 0.20],
  ['C-east-cafe-arcade',   -3.0, -22,    look(-3.0, -22, 7, -22),     0, 0.3],
  ['C-west-grocery-hotel', 3.0, -86,     look(3.0, -86, -7, -86),     0, 0.3],
  ['C-east-cinema-bodega', -3.0, -86,    look(-3.0, -86, 7, -86),     0, 0.3],
  ['C-res-join-north',     -2.0, -35,    look(-2.0, -35, 7, -35),     0, 0.3],
  ['C-res-join-south',     -2.0, -53,    look(-2.0, -53, 7, -53),     0, 0.3],
  ['C-roofline-east',       0,   -30,    look(0, -30, 7, -30),        0, 1.05],
  ['C-roofline-west',       0,   -30,    look(0, -30, -7, -30),       0, 1.05],
  ['C-north-cross',         0,   11,     look(0, 11, 0, 14),          0, 0.35],
  ['C-north-cross-west',   -3.0, 11,     look(-3.0, 11, -7, 13.6),    0, 0.35],
  ['C-north-cross-east',    3.0, 11,     look(3.0, 11, 7, 13.6),      0, 0.35],
  ['C-side-north-joins',   22,   -101,   look(22, -101, 22, -96),     0, 0.3],
  ['C-side-north-graze',   10,   -97.2,  look(10, -97.2, 50, -96.1),  0.14, 0.2],
  ['C-side-south-joins',   22,   -105,   look(22, -105, 22, -110),    0, 0.3],
  ['C-side-south-graze',   -4,  -109.2,  look(-4, -109.2, 50, -110.1), 0.14, 0.2],
  ['C-side-east-end',      45,  -103,    look(45, -103, 57, -103),    0, 0.3],
  ['C-side-east-corner',   50,  -98.5,   look(50, -98.5, 57.5, -96.5), 0.14, 0.3],
  ['C-sw-corner-radio',    -3,  -100,    look(-3, -100, -7, -97),     0, 0.35],
  ['C-hotel-corner',        0,  -95,     look(0, -95, -7, -97.5),     0, 0.4],

  // ── D. the alley ─────────────────────────────────────────────────────────
  ['D-alley-mouth',        -4.0, -40.2,  look(-4.0, -40.2, -13, -40.2), 0, 0.15],
  ['D-alley-mouth-north',  -5.2, -34.5,  look(-5.2, -34.5, -7.3, -37.4), 0.14, 0.3],
  ['D-alley-mouth-south',  -5.2, -46.5,  look(-5.2, -46.5, -7.3, -43.1), 0.14, 0.3],
  ['D-alley-inside',       -9.5, -40.2,  look(-9.5, -40.2, -13.6, -40.2), 0, 0.1],
  ['D-alley-flank-N-graze',-8.0, -38.6,  look(-8.0, -38.6, -13.6, -37.2), 0, 0.2],
  ['D-alley-flank-S-graze',-8.0, -41.9,  look(-8.0, -41.9, -13.6, -43.3), 0, 0.2],
  ['D-alley-floor',        -10.0,-40.2,  look(-10.0, -40.2, -12.5, -40.2), 0, -0.85],
  ['D-alley-up',           -10.0,-40.2,  look(-10.0, -40.2, -12.5, -40.2), 0, 1.15],
  ['D-alley-endwall-corner',-11.5,-39.0, look(-11.5, -39.0, -13.4, -37.3), 0, 0.25],
  ['D-alley-dumpster',     -9.0, -35.6,  look(-9.0, -35.6, -11.2, -38.2), 0.14, -0.15],

  // ── E. the walk-up: entrance, lobby, stair, hall, room ───────────────────
  ['E-entrance-front',      5.4, -44,    look(5.4, -44, 7, -44),      0, 0.15],
  ['E-entrance-graze',      6.35,-38,    look(6.35, -38, 6.85, -44),  0.14, 0.05],
  ['E-entrance-stoop',      6.0, -44,    look(6.0, -44, 7, -44),      0.14, -0.75],
  ['E-lobby',             201.2, -18.5,  Math.PI,                     0, 0.1],
  ['E-lobby-floor',       201.0, -17.0,  Math.PI,                     0, -0.95],
  ['E-lobby-corner',      200.6, -17.5,  look(200.6, -17.5, 200, -20.1), 0, 0.1],
  ['E-stairs',            200.6, -10.0,  Math.PI,                     1.0, 0.35],
  ['E-stairs-under',      201.6, -8.4,   Math.PI,                     0, 0.3],
  ['E-hall3',             200.6, -18.2,  Math.PI * 0.9,               5.4, 0],
  ['E-hall3-ceiling',     200.6, -14.5,  Math.PI,                     5.4, 1.1],
  ['E-hall3-floor',       200.6, -14.5,  Math.PI,                     5.4, -1.05],
  ['E-room301',           199.6, -16.5,  look(199.6, -16.5, 197, -15.3), 5.4, 0.1],
  ['E-room301-corner',    198.2, -16.0,  look(198.2, -16.0, 196.8, -18.1), 5.4, 0.5],
  ['E-room301-floor',     198.2, -16.0,  look(198.2, -16.0, 196.8, -18.1), 5.4, -0.95],

  // ── F. the bodega interior ───────────────────────────────────────────────
  ['F-bodega-in',         241.3, -17,    Math.PI / 2,                 0, 0.1],
  ['F-bodega-floor',      244.0, -15,    Math.PI / 2,                 0, -0.95],
  ['F-bodega-ceiling',    244.0, -15,    Math.PI / 2,                 0, 1.05],
  ['F-bodega-corner-NW',  241.5, -17.8,  look(241.5, -17.8, 240.2, -18.9), 0, 0.1],
  ['F-bodega-corner-SE',  246.5, -12.5,  look(246.5, -12.5, 247.9, -11.2), 0, 0.1],
  ['F-bodega-door',       242.5, -17,    look(242.5, -17, 240, -17),  0, 0.05],
  ['F-bodega-graze-wall', 240.4, -11.5,  look(240.4, -11.5, 240.1, -18.8), 0, 0.05],

  // ── G. props against surfaces, and the roofline from the street ──────────
  ['G-payphone',          -5.2, -11,     look(-5.2, -11, -6.5, -11),  0, 0.05],
  ['G-lamp-base',          4.6, -23,     look(4.6, -23, 5.55, -23),   0, -0.75],
  ['G-hydrant',            4.2, -6,      look(4.2, -6, 5.35, -6),     0, -0.3],
  ['G-hotel-sign',        -1.0, -92,     look(-1.0, -92, -7, -92),    0, 0.45],
  ['G-parapet-graze',      6.4, -60,     look(6.4, -60, 6.9, -20),    0.14, 1.0],

  // ── H. night pass over the same corners ──────────────────────────────────
  ['H-night-corner',       3.5, -100.5,  look(3.5, -100.5, 8, -95),   0, 0.15, [23, 0]],
  ['H-night-kerb',         4.3, -20,     look(4.3, -20, 5.15, -60),   0, -0.22, [23, 0]],
  ['H-night-lamp',         2.0, -23,     look(2.0, -23, 3.8, -23),    0, 0.5, [23, 0]],
  ['H-night-alley',       -8.0, -40.2,   look(-8.0, -40.2, -13.6, -40.2), 0, 0.1, [23, 0]],
  ['H-day-back',           0,   -30,     0,                           0, 0, [13, 0]],
];

const want = process.argv.slice(2);
const list = want.length ? SHOTS.filter((s) => want.some((w) => s[0].startsWith(w))) : SHOTS;

mkdirSync('shots', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4182/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await page.evaluate(() => window.__ct.clock(13, 0));
await page.waitForTimeout(800);

for (const [label, x, z, yaw, gy, pitch, hm] of list) {
  await page.evaluate(([x, z, yaw, gy, pitch, hm]) => {
    if (hm) window.__ct.clock(hm[0], hm[1]);
    window.__ct.warp(x, z, yaw, gy, pitch);
  }, [x, z, yaw, gy, pitch, hm ?? null]);
  await page.waitForTimeout(hm ? 900 : 260);
  await page.screenshot({ path: `shots/seam-${label}.png` });
  if (hm) await page.evaluate(() => window.__ct.clock(13, 0));
  console.log(label);
}
await browser.close();
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log(`\n${list.length} shots done`);
