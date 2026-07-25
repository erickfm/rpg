import { chromium } from 'playwright';
const look = (x, z, tx, tz) => Math.atan2(tx - x, -(tz - z));
const S = [
  // 1 hotel blade mast — is anything tying it to the wall? sky behind
  ['F-blade-mast-below',  44.35, -100.5, look(44.35,-100.5, 44.35,-96.7), 0, 0.75],
  ['F-blade-mast-side',   40.0,  -98.5,  look(40.0,-98.5, 44.35,-96.7),   0, 0.62],
  ['F-blade-mast-under',  44.35, -97.6,  look(44.35,-97.6, 44.35,-96.7),  0, 1.15],
  // 2 golden aces legs, from below, sky behind
  ['F-aces-legs',         51.23, -101.0, look(51.23,-101.0, 51.23,-95.0), 0, 1.00],
  ['F-aces-legs-side',    45.0,  -100.0, look(45.0,-100.0, 51.2,-95.0),   0, 0.95],
  // 3 library cornice, 16 m runs at y 11.8-13.2, sky above
  ['F-library-cornice',   -1.0,  -13,    look(-1.0,-13, -7,-13),          0, 1.05],
  ['F-library-cornice-2', -3.0,  -6.0,   look(-3.0,-6.0, -7,-14),         0, 0.85],
  // 4 church facade boxes at y 12.6, z -109.8
  ['F-church-boxes',      -3.9,  -105,   look(-3.9,-105, -3.9,-110),      0, 1.05],
  ['F-church-boxes-2',     0.0,  -104,   look(0.0,-104, 2.9,-110),        0, 0.95],
  // 5 bodega bay awning underside
  ['F-awning-under',       6.2,  -97.4,  look(6.2,-97.4, 7.8,-95.6),      0, 0.95],
  ['F-awning-side',        4.0,  -95.0,  look(4.0,-95.0, 7.6,-95.3),      0, 0.55],
  // 6 the 0.4x0.52 plate on the east kerb at z=-33.5
  ['F-plate-east',         3.2,  -33.5,  look(3.2,-33.5, 5.3,-33.5),      0, 0.30],
  ['F-plate-east-sky',     4.6,  -31.0,  look(4.6,-31.0, 5.32,-33.5),     0, 0.55],
  // 7 apartment stairwell: flights, balusters, ceiling domes
  ['F-apt-flight',       200.6,  -13.5,  look(200.6,-13.5, 201.8,-10.5),  2.7, 0.55],
  ['F-apt-balusters',    201.4,  -12.0,  look(201.4,-12.0, 201.2,-10.4),  2.7, 0.35],
  ['F-apt-dome',         201.2,  -14.5,  look(201.2,-14.5, 201.2,-16.5),  5.4, 0.95],
  ['F-apt-dome-2',       201.2,  -10.0,  look(201.2,-10.0, 201.2,-7.8),   0,   1.05],
  // 8 bodega interior ceiling + bulb glows
  ['F-bodega-ceil',      244.0,  -15.0,  look(244.0,-15.0, 244,-17.5),    0, 1.05],
];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
console.error(`[measuring ${process.env.SHOT_URL ?? 'http://localhost:4184/'}]`);   // say WHICH world — 24163f69
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(800);
for (const [l,x,z,yaw,gy,pitch] of S) {
  await p.evaluate(([x,z,yaw,gy,pitch]) => window.__ct.warp(x,z,yaw,gy,pitch), [x,z,yaw,gy,pitch]);
  await p.waitForTimeout(250);
  await p.screenshot({ path: `shots/float-${l}.png` });
}
await b.close(); console.log('ok');
