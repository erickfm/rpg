// Seam audit, re-run against the RE-CAST block (live @ 9610e25).
// The roster changed completely, so every camera in seams.mjs/seams2.mjs is
// aimed at a building that has moved. Layout recomputed from the rosters:
//
//   WEST  z:  DINER 14.2..5.0 · MERIDIAN 5.0..-5.0 · LIBRARY -5..-21 ·
//             BURGER BARN -21..-37 · [alley -37..-43.5] · LAUNDRY -43.5..-55.5 ·
//             BARBER -55.5..-68 · THRIFT -68..-82 · GROCERY -82..-98
//   EAST  z:  CAFE 14.2..3 · HARDWARE 3..-9 · A-1 TAX -9..-22 · SLEEP CENTER -22..-35 ·
//   (the -22..-35 slot was LIQUOR until item 166 — same 13 m width, new identity)
//             No.227 -35..-53 · PAWN -53..-65 · DELI -65..-76 · RECORDS -76..-86 ·
//             BODEGA -86..-96
//   NORTH2 x: FLOWERS 16.45..22.45 · CHOP SUEY 22.45..33.45 ·
//             HOTEL ORPHEUS 33.45..45.45 · SEVENS 45.45..57
//   SOUTH2 x: ST BRIGID -7..11 · GARAGE 11..23 · BILLIARDS 23..35 ·
//             SMOKES 35..46 · LOANS 46..57
//
//   SHOT_URL=http://localhost:4182/ node scripts/seams4.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
const look = (x, z, tx, tz) => Math.atan2(tx - x, -(tz - z));
const DOWN = -1.3;

const SHOTS = [
  // ── the new civic stone: the library, west side z −5…−21 ────────────────
  ['N-library-front',      3.0, -13,   look(3.0, -13, -7, -13),    0, 0.40],
  ['N-library-front-up',   1.0, -13,   look(1.0, -13, -7, -13),    0, 0.95],
  ['N-library-graze',     -6.3, 2,     look(-6.3, 2, -6.9, -30),   0.14, 0.30],
  ['N-library-graze-back',-6.3, -30,   look(-6.3, -30, -6.9, 2),   0.14, 0.30],
  ['N-library-j-meridian', 2.0, -5,    look(2.0, -5, -7, -5),      0, 0.45],
  ['N-library-j-burger',   2.0, -21,   look(2.0, -21, -7, -21),    0, 0.45],
  ['N-library-x-meridian',-4.0, -1.5,  look(-4.0, -1.5, -7, -5),   0, 0.40],
  ['N-library-x-burger',  -4.0, -24.5, look(-4.0, -24.5, -7, -21), 0, 0.40],
  ['N-library-base',      -5.4, -13,   look(-5.4, -13, -7, -13),   0, -0.70],

  // ── BURGER BARN, west z −21…−37, and its join to the alley at −37 ───────
  ['N-burger-front',       3.0, -29,   look(3.0, -29, -7, -29),    0, 0.35],
  ['N-burger-graze',      -6.3, -22,   look(-6.3, -22, -6.9, -37), 0.14, 0.15],
  ['N-burger-alley-arris',-4.0, -34.0, look(-4.0, -34.0, -7, -37), 0, 0.35],
  ['N-burger-night',       3.0, -29,   look(3.0, -29, -7, -29),    0, 0.35, [22, 30]],

  // ── ST BRIGID, south side street x −7…11, facade on z = −110 ───────────
  ['N-church-front',       2.0, -102,  look(2.0, -102, 2, -110),   0, 0.55],
  ['N-church-front-wide', -2.0, -100,  look(-2.0, -100, 5, -110),  0, 0.45],
  ['N-church-below',       2.0, -108.6, look(2.0, -108.6, 2, -110), 0, 1.25],
  ['N-church-tower-up',    6.0, -106,  look(6.0, -106, 8, -110),   0, 1.10],
  ['N-church-graze',      -4.5, -109.2, look(-4.5, -109.2, 20, -110), 0.14, 0.35],
  ['N-church-x-garage',   14.0, -105,  look(14.0, -105, 11, -110), 0, 0.40],
  ['N-church-x-west',     -4.0, -105,  look(-4.0, -105, -7, -110), 0, 0.40],
  ['N-church-roof-plan',   2.0, -104,  0,                          0, 1.28],

  // ── SEVENS x 45.45…57 and HOTEL ORPHEUS x 33.45…45.45, z = −96 ────
  ['N-aces-front',        51.0, -103,  look(51.0, -103, 51, -96),  0, 0.45],
  ['N-aces-up',           51.0, -99,   look(51.0, -99, 51, -96),   0, 1.05],
  ['N-aces-graze',        58.0, -97.0, look(58.0, -97.0, 30, -96.1), 0.14, 0.25],
  ['N-aces-graze-rev',    24.0, -97.0, look(24.0, -97.0, 56, -96.1), 0.14, 0.25],
  ['N-aces-x-crossbld',   52.0, -100,  look(52.0, -100, 57, -96),  0, 0.45],
  ['N-orpheus-front',     39.0, -103,  look(39.0, -103, 39, -96),  0, 0.45],
  ['N-orpheus-blade',     36.0, -100,  look(36.0, -100, 40, -96),  0, 0.60],
  ['N-orpheus-blade-rev', 44.0, -100,  look(44.0, -100, 40, -96),  0, 0.60],
  ['N-orpheus-j-aces',    45.45, -102, look(45.45, -102, 45.45, -96), 0, 0.40],
  ['N-aces-night',        51.0, -103,  look(51.0, -103, 51, -96),  0, 0.45, [22, 30]],
  ['N-orpheus-night',     39.0, -103,  look(39.0, -103, 39, -96),  0, 0.45, [22, 30]],

  // ── the three character shopfronts, and MERIDIAN's odd pale brick ──────
  ['N-tax-front',         -2.0, -15.5, look(-2.0, -15.5, 7, -15.5), 0, 0.30],
  ['N-pawn-front',        -2.0, -59,   look(-2.0, -59, 7, -59),     0, 0.30],
  ['N-meridian-front',     3.0, 0,     look(3.0, 0, -7, 0),         0, 0.40],

  // ── re-verify the standing findings against the re-cast world ──────────
  ['V-shopband-seam',     -2.0, -70.5, look(-2.0, -70.5, 7, -70.5), 0, 0.30],   // DELI, shop band top now y=4.2
  ['V-res-band-step',     -1.0, -53,   look(-1.0, -53, 7, -53),     0, 0.30],   // No.227(3.2) meets PAWN(4.2)
  ['V-res-band-step-2',   -1.0, -35,   look(-1.0, -35, 7, -35),     0, 0.30],   // SLEEP CENTER(4.2), was LIQUOR, meets No.227(3.2)
  ['V-res-band-graze',     6.3, -30,   look(6.3, -30, 6.9, -60),    0.14, 0.20],
  ['V-endcap-east',       -1.5, -65,   look(-1.5, -65, 7, -65),     0, 0.35],   // PAWN 5fl vs DELI 3fl
  ['V-endcap-west',        1.5, -82,   look(1.5, -82, -7, -82),     0, 0.35],   // GROCERY 5fl vs THRIFT 4fl
  ['V-bodega-arris',       6.0, -99.0, look(6.0, -99.0, 9, -96),    0, 0.35],
  ['V-bodega-arris-up',    6.0, -99.0, look(6.0, -99.0, 9, -96),    0, 0.85],
  ['V-road-seam-98',       0,   -98,   0,                           0, DOWN],
  ['V-alley-mouth-plan',  -6.2, -40.2, 0,                           0.14, DOWN],
  ['V-alley-threshold',   -5.6, -40.2, look(-5.6, -40.2, -9, -40.2), 0.14, -0.75],
  ['V-treepit-plan',       5.4, -29.5, 0,                           0.14, DOWN],
  ['V-walk-corner-plan',   7.2, -95.6, 0,                           0.14, DOWN],
  ['V-alley-up',         -10.0, -40.2, look(-10.0, -40.2, -12.5, -40.2), 0, 1.15],
  ['V-kerb-graze',         4.35, -56,  look(4.35, -56, 5.1, -74),   0, -0.20],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
await page.goto(aim('http://localhost:4182/'), { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, aim('http://localhost:4182/'));   // GOTCHAS 26: prove it, do not just name it
await page.evaluate(() => window.__ct.clock(13, 0));
await page.waitForTimeout(800);

for (const [label, x, z, yaw, gy, pitch, hm] of SHOTS) {
  await page.evaluate(([x, z, yaw, gy, pitch, hm]) => {
    if (hm) window.__ct.clock(hm[0], hm[1]);
    window.__ct.warp(x, z, yaw, gy, pitch);
  }, [x, z, yaw, gy, pitch, hm ?? null]);
  await page.waitForTimeout(hm ? 900 : 240);
  await page.screenshot({ path: `shots/seam2-${label}.png` });
  if (hm) await page.evaluate(() => window.__ct.clock(13, 0));
}

// bodega door probe again — the crate collider is unchanged on live
const probe = await page.evaluate(async () => {
  const out = [];
  const SPOT = { x: 8.7, z: -96.85 };
  const look = (x, z, tx, tz) => Math.atan2(tx - x, -(tz - z));
  const runFrom = async (x, z, yaw, label) => {
    window.__ct.warp(x, z, yaw, 0.14, 0);
    await new Promise((r) => setTimeout(r, 120));
    let best = Infinity;
    for (let i = 0; i < 140; i++) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
      await new Promise((r) => requestAnimationFrame(r));
      const p = window.__ct.pos();
      best = Math.min(best, Math.hypot(p[0] - SPOT.x, p[2] - SPOT.z));
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }));
    const p = window.__ct.pos();
    out.push({ label, end: [+p[0].toFixed(2), +p[2].toFixed(2)], closest: +best.toFixed(2), trigger_r: 1.1 });
  };
  await runFrom(14, -97.0, look(14, -97.0, 8.7, -96.85), 'west along the north walk');
  await runFrom(8.7, -99.5, look(8.7, -99.5, 8.7, -96.85), 'north off the roadway');
  return out;
});
console.log('BODEGA DOOR PROBE');
for (const r of probe) console.log(JSON.stringify(r));

await browser.close();
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log(`${SHOTS.length} shots done`);
