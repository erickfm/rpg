// WALK THE WHOLE LOOP AND LOOK AT IT, as the user asked. Twelve stations round
// the circuit at eye height, each looking ALONG the path and then OUT at the
// boundary — the two things you actually see while walking it. Plus a page-error
// listener, because a fault you can see is not the only kind worth catching on
// a lap.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4182/';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1000, height: 600 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);
// DAYLIGHT AND NIGHT, because the desk asked for both and they fail
// differently: daylight shows shape and tone, night shows what the lamps do to
// pale objects and what disappears entirely.
const HOUR = Number(process.env.E_HOUR ?? 13);
await page.evaluate(([h]) => window.__ct.clock(h, 20), [HOUR]);

// the loop, from park.ts: legs at x -32.5 / -13.25, ends at z -92 / -74, cham 2.6
const L = { x0: -32.5, x1: -13.25, z0: -92.0, z1: -74.0 };
const TAG = HOUR > 6 && HOUR < 19 ? '' : 'night-';
const stations = [];
for (let i = 0; i < 4; i++) {                     // street leg, south to north
  const t = i / 3;
  stations.push({ x: L.x1, z: L.z0 + 2.6 + t * (L.z1 - L.z0 - 5.2), yaw: Math.PI, tag: `street${i}` });
}
for (let i = 0; i < 3; i++) {                     // north end, street to back
  const t = i / 2;
  stations.push({ x: L.x1 - 2.6 - t * (L.x1 - L.x0 - 5.2), z: L.z1, yaw: -Math.PI / 2, tag: `north${i}` });
}
for (let i = 0; i < 3; i++) {                     // back leg, north to south
  const t = i / 2;
  stations.push({ x: L.x0, z: L.z1 - 2.6 - t * (L.z1 - L.z0 - 5.2), yaw: 0, tag: `back${i}` });
}
for (let i = 0; i < 2; i++) {                     // south end, back to street
  const t = i / 1;
  stations.push({ x: L.x0 + 2.6 + t * (L.x1 - L.x0 - 5.2), z: L.z0, yaw: Math.PI / 2, tag: `south${i}` });
}
for (const s of stations) {
  await page.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0.14, 0.02), [s.x, s.z, s.yaw]);
  await page.waitForTimeout(950);
  await page.screenshot({ path: `shots/E-loopwalk/${TAG}${s.tag}-along.png` });
  await page.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0.14, 0.06),
    [s.x, s.z, s.yaw - Math.PI / 2]);
  await page.waitForTimeout(750);
  await page.screenshot({ path: `shots/E-loopwalk/${TAG}${s.tag}-out.png` });
}
console.log(`${stations.length} stations walked`);
console.log(errs.length ? `PAGE ERRORS: ${errs.join(' | ')}` : 'no page errors on the lap');
await b.close();

// SAY SO. This script takes pictures and asserts NOTHING, and three times
// today I read a silent run of one as a pass — that is how a shelter roof
// floated 0.20 m over its posts through two rebuilds and how the mowing sat
// at 11.4% contrast after being reported fixed. GOTCHAS 24: name a script
// for what it ASSERTS. This one asserts nothing, so it says so out loud.
console.log('LOOKS ONLY — asserts nothing. Open the shots in shots/ and judge them.');
