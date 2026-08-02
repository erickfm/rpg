// w45 / item 95 — the parked car that is ACTUALLY under a lamp, photographed.
//
// The first car frames showed a flat pickup and looked like a failure, but the
// nearest lamp to it was outside LAMP_R -- a car 9 m from a 7 m lamp is
// correctly dark, and photographing it proves nothing either way. So: ask the
// world which parked car is closest to a lamp head, and stand in front of THAT
// one.
//
//   SHOT_URL=http://localhost:4189/ node scripts/probes/w45-carunder.mjs [tag]
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { setNight } from '../lib/clock.mjs';

const TAG = process.argv[2] || 'after';
const URL = aim('http://localhost:4189/');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await setNight(page, 23, 0);

const pick = await page.evaluate(() => {
  const sc = window.__ct.scene();
  const lamps = [];
  sc.traverse((o) => {
    if (o.userData && o.userData.lampPart === 'lens') {
      o.updateWorldMatrix(true, false);
      const e = o.matrixWorld.elements;
      lamps.push({ x: e[12], z: e[14] });
    }
  });
  // A parked car is a GROUP sitting in the roadway with a lot of small meshes
  // in it. Identify by shape rather than by a tag, because ct/cars.ts sets none.
  const cars = [];
  sc.traverse((o) => {
    if (o.isMesh || !o.children || o.children.length < 6) return;
    o.updateWorldMatrix(true, false);
    const e = o.matrixWorld.elements;
    const x = e[12], y = e[13], z = e[14];
    if (Math.abs(y) > 1.2 || Math.abs(x) > 8 || z > 5 || z < -95) return;
    let meshes = 0;
    o.traverse((c) => { if (c.isMesh) meshes++; });
    if (meshes < 8 || meshes > 200) return;
    const d = Math.min(...lamps.map((l) => Math.hypot(l.x - x, l.z - z)));
    cars.push({ x: +x.toFixed(2), z: +z.toFixed(2), meshes, toLamp: +d.toFixed(2) });
  });
  cars.sort((a, b) => a.toLamp - b.toLamp);
  return { lamps: lamps.length, cars: cars.slice(0, 6) };
});
console.log(`lamps ${pick.lamps}; parked groups nearest a lamp head:`);
for (const c of pick.cars) console.log(`  (${c.x}, ${c.z})  ${c.meshes} meshes  ${c.toLamp} m from a lamp`);
if (!pick.cars.length) { console.log('found none'); await browser.close(); process.exit(1); }

const car = pick.cars[0];
// stand across the road from it, far enough back to see the car and the ground
const camX = car.x > 0 ? car.x - 6.5 : car.x + 6.5;
const yaw = car.x > 0 ? Math.PI / 2 : -Math.PI / 2;
await page.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, -0.10), [camX, car.z, yaw]);
await page.waitForTimeout(500);
await page.screenshot({ path: `shots/w45-carunder-${TAG}.png` });
console.log(`\ncar at (${car.x}, ${car.z}), ${car.toLamp} m from its lamp`);
console.log(`  shots/w45-carunder-${TAG}.png`);
await browser.close();
