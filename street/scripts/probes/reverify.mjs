// Re-verify seam pattern #1 after builder A's density fix. Same instances,
// same kind of cameras as notes/seam-audit.md, against the current world.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const look = (x, z, tx, tz) => Math.atan2(tx - x, -(tz - z));
const S = [
  // A's own tightest test: BODEGA wing | FLOWERS | CHOP SUEY, one frame
  ['V1-flowers',        19.5, -102,  look(19.5,-102, 19.5,-96),    0, 0.35],
  ['V1-flowers-close',  17.0, -100,  look(17.0,-100, 20,-96),      0, 0.30],
  // finding 7 — floor-count change: HARDWARE 3fl | A-1 TAX 5fl at z=-9
  ['V2-join-3v5',       -2.0, -9,    look(-2.0,-9, 7,-9),          0, 0.35],
  ['V2-join-3v5-up',    -1.0, -9,    look(-1.0,-9, 7,-9),          0, 0.80],
  // finding 3 — shop band vs wall above, plain shop (DELI)
  ['V3-shopband',       -2.0, -70.5, look(-2.0,-70.5, 7,-70.5),    0, 0.30],
  ['V3-shopband-close',  4.0, -70.5, look(4.0,-70.5, 7,-70.5),     0.14, 0.25],
  // R3 — No.227 (band 3.2) | PAWN (band 4.2) at z=-53
  ['V4-227-band',       -1.0, -53,   look(-1.0,-53, 7,-53),        0, 0.30],
  ['V4-227-band-2',     -1.0, -35,   look(-1.0,-35, 7,-35),        0, 0.30],
  // finding 2 / 12 — the bodega canted bay
  ['V5-bodega-arris',    6.0, -99.0, look(6.0,-99.0, 9,-96),       0, 0.35],
  ['V5-bodega-arris-up', 6.0, -99.0, look(6.0,-99.0, 9,-96),       0, 0.85],
  // civic stone against brick: LIBRARY | MERIDIAN z=-5, LIBRARY | BURGER z=-21
  ['V6-lib-meridian',    2.0, -5,    look(2.0,-5, -7,-5),          0, 0.40],
  ['V6-lib-burger',      2.0, -21,   look(2.0,-21, -7,-21),        0, 0.40],
  ['V6-church-garage',  14.0, -105,  look(14.0,-105, 11,-110),     0, 0.40],
  // finding 8 — north cross building at z=13.5 vs CAFE at x=7
  ['V7-north-cross',     4.0, 10.5,  look(4.0,10.5, 7,13.5),       0, 0.35],
  // finding 9 — east cross building at x=57 vs SEVENS
  ['V8-east-cross',     52.0, -101,  look(52.0,-101, 57,-96),      0, 0.35],
  // finding 19 — alley flank vs street brick at the mouth
  ['V9-alley-arris',    -4.0, -34.0, look(-4.0,-34.0, -7,-37),     0, 0.35],
];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, process.env.SHOT_URL ?? 'http://localhost:4184/');   // GOTCHAS 26: prove it, do not just name it
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(800);
for (const [l,x,z,yaw,gy,pitch] of S) {
  await p.evaluate(([x,z,yaw,gy,pitch]) => window.__ct.warp(x,z,yaw,gy,pitch), [x,z,yaw,gy,pitch]);
  await p.waitForTimeout(250);
  await p.screenshot({ path: `shots/reverify-${l}.png` });
}
await b.close(); console.log('ok');
