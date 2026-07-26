// THE CONDITIONS THE USER ACTUALLY REPORTED IT IN. Their frame was dim and
// raining, and that is when the park path collapsed onto the carriageway. I
// checked the fix at noon. A tone that only separates in full sun is not fixed.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4182/';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1000, height: 600 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);
const rainy = await page.evaluate(() => {
  const f = window.__ct.scene().userData.rainAt;
  for (let h = 0; h < 240; h++) if (f(h) && (h % 24) >= 17 && (h % 24) <= 20) return h % 24;
  return 19;
});
// stand where the park path and the roadway are BOTH in frame, which is the
// comparison the user was making
for (const [tag, h] of [['dusk-rain', rainy], ['dusk-dry', 18], ['night', 22]]) {
  await page.evaluate(([h]) => window.__ct.clock(h, 30), [h]);
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.__ct.warp(-9.4, -78.0, -1.35, 0.14, 0.02));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `shots/E-dim/${tag}.png` });
}
// and the numbers: park path against the carriageway, same frame
const t = await page.evaluate(() => {
  const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  const V3 = Object.getPrototypeOf(window.__ct.scene().position).constructor;
  let path = null, road = null;
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.material?.color) return;
    o.updateWorldMatrix(true, false);
    const v = new V3().setFromMatrixPosition(o.matrixWorld);
    const g = o.geometry?.parameters;
    if (!g?.width || o.geometry.type !== 'PlaneGeometry') return;
    if (v.y > 0.3) return;
    if (v.x < -34 && v.x > -35 && g.width < 3 && !path) path = lum(o.material.color);
    if (Math.abs(v.x) < 4 && g.width > 8 && !road) road = lum(o.material.color);
  });
  return { path, road };
});
console.log(`rainy dusk hour ${rainy}:30; path tint ${t.path}, road tint ${t.road}`);
await b.close();

// SAY SO. This script takes pictures and asserts NOTHING, and three times
// today I read a silent run of one as a pass — that is how a shelter roof
// floated 0.20 m over its posts through two rebuilds and how the mowing sat
// at 11.4% contrast after being reported fixed. GOTCHAS 24: name a script
// for what it ASSERTS. This one asserts nothing, so it says so out loud.
console.log('LOOKS ONLY — asserts nothing. Open the shots in shots/ and judge them.');
