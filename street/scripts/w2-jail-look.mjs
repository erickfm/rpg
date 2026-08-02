import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4181/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(1500);
if (errs.length) console.log('CONSOLE ERRORS:', errs);

const look = (fx, fz, tx, tz) => Math.atan2(tx - fx, -(tz - fz));
const stations = [
  // [name, x, z, yaw]  yaw: 0 looks -z, PI/2 looks +x, -PI/2 looks -x, PI looks +z
  ['head-on-from-street', 40, -103, Math.PI / 2],
  // walking the near (south) sidewalk toward the jail, off-centre — a
  // natural approach, not standing dead in the middle of the road
  ['walking-south-sidewalk-far', 35, -98.5, look(35, -98.5, 65, -103)],
  ['walking-south-sidewalk-near', 52, -98.5, look(52, -98.5, 65, -103)],
  ['walking-north-sidewalk-far', 35, -97.5, look(35, -97.5, 65, -103)],
  ['walking-north-sidewalk-near', 52, -97.5, look(52, -97.5, 65, -103)],
  // rounding the corner into the forecourt/yard, ON the site this time
  ['corner-into-yard-south', 62, -98.5, look(62, -98.5, 74, -110)],
  ['corner-into-yard-north', 62, -97.5, look(62, -97.5, 74, -96)],
  ['down-the-yard', 68, -103, Math.PI],
];

for (const [name, x, z, yaw] of stations) {
  await p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, window.__ct.groundAt(x, z), 0), [x, z, yaw]);
  await p.waitForTimeout(400);
  await p.screenshot({ path: `shots/w2-jail-${name}.png` });
  console.log(`shot: ${name} at (${x}, ${z}) yaw ${yaw.toFixed(2)}`);
}

await b.close();
