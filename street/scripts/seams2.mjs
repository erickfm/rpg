// Seam audit, second pass — targeted. Plan views over abutments (so the
// texture grid is unambiguous), 45° bisector views of corners (so both faces
// are the same distance from the camera and texel size can be compared
// honestly), and a walkability probe for the bodega door.
//
//   SHOT_URL=http://localhost:4182/ node scripts/seams2.mjs
import { chromium } from 'playwright';
const look = (x, z, tx, tz) => Math.atan2(tx - x, -(tz - z));
const DOWN = -1.3;

const SHOTS = [
  // plan views — camera looking straight down, so any grid break is obvious
  ['P-road-seam-98',        0,   -98,   0,        0, DOWN],
  ['P-road-seam-98-off',    3,   -98,   0,        0, DOWN],
  ['P-walk-corner',         7.2, -95.6, 0,     0.14, DOWN],
  ['P-walk-plain',          6.0, -30,   0,     0.14, DOWN],
  ['P-walk-treepit',        5.4, -29.5, 0,     0.14, DOWN],
  ['P-walk-alley-mouth',   -6.2, -40.2, 0,     0.14, DOWN],
  ['P-walk-side-north',    10.5, -97.0, 0,     0.14, DOWN],
  ['P-walk-side-south',    10.5, -109,  0,     0.14, DOWN],
  ['P-kerb-ramp',           6.0, -97.6, 0,     0.14, DOWN],
  ['P-gutter',              4.7, -30,   0,        0, DOWN],

  // 45° bisector on every corner arris — equal distance to both faces
  ['X-bodega-N-arris',      4.0, -91.2, look(4.0, -91.2, 7, -94.2), 0, 0.35],
  ['X-bodega-N-arris-up',   4.0, -91.2, look(4.0, -91.2, 7, -94.2), 0, 0.85],
  ['X-bodega-S-arris',      6.0, -99.0, look(6.0, -99.0, 9, -96),   0, 0.35],
  ['X-bodega-S-arris-up',   6.0, -99.0, look(6.0, -99.0, 9, -96),   0, 0.85],
  ['X-alley-N-arris',      -4.0, -34.0, look(-4.0, -34.0, -7, -37), 0, 0.35],
  ['X-alley-S-arris',      -4.0, -46.5, look(-4.0, -46.5, -7, -43.5), 0, 0.35],
  ['X-north-cross-W',      -4.0, 10.5,  look(-4.0, 10.5, -7, 13.5), 0, 0.35],
  ['X-north-cross-E',       4.0, 10.5,  look(4.0, 10.5, 7, 13.5),   0, 0.35],
  ['X-sw-corner-radio',    -4.0, -101,  look(-4.0, -101, -7, -98),  0, 0.35],
  ['X-side-east-end',      52,   -101,  look(52, -101, 57, -96),    0, 0.35],
  ['X-side-east-end-2',    52,   -105,  look(52, -105, 57, -110),   0, 0.35],

  // building-to-building joins seen square on, mid-block, no props in the way
  ['J-west-diner-laundry',  1.5, 2.2,   look(1.5, 2.2, -7, 2.2),    0, 0.35],
  ['J-west-pizza-pawn',     1.5, -19,   look(1.5, -19, -7, -19),    0, 0.35],
  ['J-west-music-barber',   1.5, -56,   look(1.5, -56, -7, -56),    0, 0.35],
  ['J-east-books-hardware',-1.5, 1.2,   look(-1.5, 1.2, 7, 1.2),    0, 0.35],
  ['J-east-liquor-deli',   -1.5, -64,   look(-1.5, -64, 7, -64),    0, 0.35],
  ['J-east-deli-cinema',   -1.5, -74,   look(-1.5, -74, 7, -74),    0, 0.35],
  ['J-side-flowers-tailor',22.45,-101,  look(22.45, -101, 22.45, -96), 0, 0.35],
  ['J-side-bodega-flowers',16.45,-101,  look(16.45, -101, 16.45, -96), 0, 0.35],
  ['J-side-mission-bill',  32,   -105,  look(32, -105, 32, -110),   0, 0.35],

  // shopfront band scale: narrow shop next to wide shop
  ['S-sign-scale-side',    19,   -102,  look(19, -102, 26, -96),    0, 0.2],
  ['S-sign-scale-main',    -2,   -69,   look(-2, -69, 7, -69),      0, 0.2],
  ['S-bodega-three-signs',  4.2, -99.6, look(4.2, -99.6, 8, -95.5), 0, 0.25],
  ['S-hotel',              -1.0, -90,   look(-1.0, -90, -7, -92),   0, 0.3],
  ['S-transom-227',         5.6, -44,   look(5.6, -44, 7, -44),     0, 0.35],
  ['S-transom-227-graze',   6.5, -41,   look(6.5, -41, 6.9, -44),   0.14, 0.25],
  ['S-payphone',           -5.0, -11,   look(-5.0, -11, -6.4, -11), 0, 0.1],
  ['S-apt-door-301',      199.9, -18.6, look(199.9, -18.6, 200, -16.5), 5.4, 0.05],

  // the alley threshold, the walk lip, and the flanks against the street face
  ['T-alley-threshold',    -5.6, -40.2, look(-5.6, -40.2, -9, -40.2), 0.14, -0.75],
  ['T-alley-threshold-lo', -8.5, -40.2, look(-8.5, -40.2, -6.0, -40.2), 0, -0.28],
  ['T-alley-floor-scale',  -7.5, -40.2, look(-7.5, -40.2, -11, -41), 0, -0.55],

  // entrance / stoop / walk
  ['T-stoop-graze',         6.9, -41.4, look(6.9, -41.4, 6.9, -46),  0.14, -0.45],
  ['T-stoop-close',         6.1, -44,   look(6.1, -44, 7, -44),      0.14, -0.55],

  // kerb face, unobstructed stretch (no parked car between z −55 and −70)
  ['K-kerb-graze-clear',    4.35, -56,  look(4.35, -56, 5.1, -74),   0, -0.20],
  ['K-kerb-graze-clear2',   4.5,  -74,  look(4.5, -74, 5.05, -56),   0, -0.12],
  ['K-kerb-west-graze',    -4.35, -56,  look(-4.35, -56, -5.1, -74), 0, -0.20],
  ['K-kerb-red-hydrant',    4.2,  -2,   look(4.2, -2, 5.1, -9),      0, -0.30],
  ['K-kerb-face-front',     4.0,  -60,  look(4.0, -60, 5.4, -60),    0, -0.42],
  ['K-arris-close',         5.3,  -60,  look(5.3, -60, 4.6, -60),    0.14, -0.90],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
console.error(`[measuring ${process.env.SHOT_URL ?? 'http://localhost:4182/'}]`);   // say WHICH world — 24163f69
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4182/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await page.evaluate(() => window.__ct.clock(13, 0));
await page.waitForTimeout(800);

for (const [label, x, z, yaw, gy, pitch] of SHOTS) {
  await page.evaluate(([x, z, yaw, gy, pitch]) => window.__ct.warp(x, z, yaw, gy, pitch), [x, z, yaw, gy, pitch]);
  await page.waitForTimeout(240);
  await page.screenshot({ path: `shots/seam-${label}.png` });
}

// ── walkability probe: can the player actually reach the bodega [E] spot? ──
// Drive the rig with real key input from a few approach points and report the
// closest approach to the trigger and whether the prompt ever appears.
const probe = await page.evaluate(async () => {
  const out = [];
  const SPOT = { x: 8.7, z: -96.85, r: 1.1 };
  const promptText = () => {
    const el = [...document.querySelectorAll('*')].find((e) =>
      e.children.length === 0 && /\[E\]/.test(e.textContent ?? ''));
    return el ? el.textContent.trim() : null;
  };
  const runFrom = async (x, z, yaw, label) => {
    window.__ct.warp(x, z, yaw, 0.14, 0);
    await new Promise((r) => setTimeout(r, 120));
    let best = Infinity, seen = null;
    for (let i = 0; i < 140; i++) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
      await new Promise((r) => requestAnimationFrame(r));
      const p = window.__ct.pos();
      const d = Math.hypot(p[0] - SPOT.x, p[2] - SPOT.z);
      if (d < best) best = d;
      const t = promptText();
      if (t && /BODEGA/i.test(t)) seen = t;
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }));
    const p = window.__ct.pos();
    out.push({ label, from: [x, z], end: [+p[0].toFixed(2), +p[2].toFixed(2)], closest: +best.toFixed(2), prompt: seen });
  };
  const look = (x, z, tx, tz) => Math.atan2(tx - x, -(tz - z));
  await runFrom(14, -97.0, look(14, -97.0, 8.7, -96.85), 'along north walk from the east');
  await runFrom(8.7, -99.5, look(8.7, -99.5, 8.7, -96.85), 'straight in off the side-street road');
  await runFrom(4.0, -99.5, look(4.0, -99.5, 8.7, -96.85), 'diagonally across the intersection');
  await runFrom(7.0, -92, look(7.0, -92, 8.0, -96.5), 'south down the east walk');
  return out;
});
console.log('\nBODEGA DOOR PROBE');
for (const r of probe) console.log(JSON.stringify(r));

await browser.close();
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log(`\n${SHOTS.length} shots done`);
