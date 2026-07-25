// The flank and the greenhouse have to agree. Shoot each parked car side-on so
// the shut lines, the handles and the pillars can be read against each other.
// Usage: SHOT_URL=... node scripts/doors.mjs
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(process.env.SHOT_URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await p.waitForTimeout(400);
await p.evaluate(() => window.__ct.clock(13, 0));
const cars = await p.evaluate(() => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (o.type === 'Group' && o.userData.steer !== undefined && o.visible && o.position.x < 60) {
      out.push({ x: +o.position.x.toFixed(2), z: +o.position.z.toFixed(2), wb: o.userData.wheelbase });
    }
  });
  return out;
});
let i = 0;
for (const c of cars) {
  // stand square to the flank, far enough back to see the whole side
  const side = c.x > 0 ? -1 : 1;
  const cx = c.x + side * 6.5;
  await p.evaluate(([cx, cz, tx, tz]) =>
    window.__ct.warp(cx, cz, Math.atan2(tx - cx, -(tz - cz)), 0, 0.04), [cx, c.z, c.x, c.z]);
  await p.waitForTimeout(260);
  await p.screenshot({ path: `shots/doors-${i}.png` });
  console.log(`  car ${i} at (${c.x}, ${c.z}) wheelbase ${c.wb} -> shots/doors-${i}.png`);
  i++;
}
await b.close();
