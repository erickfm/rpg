// Judge a wheel arch from where the user judges it: standing at the kerb beside
// a parked car, eye level, no pitch tricks.
// Usage: SHOT_URL=... node scripts/kerb.mjs [tag]
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const tag = process.argv[2] ?? 'now';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(p, process.env.SHOT_URL);   // GOTCHAS 26: prove it, do not just name it
await p.waitForTimeout(400);
await p.evaluate(() => window.__ct.clock(13, 0));
const cars = await p.evaluate(() => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (o.type === 'Group' && o.userData.steer !== undefined && o.visible
        && Math.abs(o.position.x) > 2 && Math.abs(o.position.x) < 8 && o.position.z > -60) {
      out.push({ x: +o.position.x.toFixed(2), z: +o.position.z.toFixed(2) });
    }
  });
  return out;
});
let i = 0;
for (const c of cars.slice(0, 3)) {
  const side = c.x > 0 ? 1 : -1;             // stand on the pavement side
  const cx = c.x + side * 2.6;
  // eye level on the kerb, looking level at the wheel — no downward pitch
  await p.evaluate(([cx, cz, tx, tz]) =>
    window.__ct.warp(cx, cz, Math.atan2(tx - cx, -(tz - cz)), 0.14, -0.22), [cx, c.z - 1.5, c.x, c.z - 1.5]);
  await p.waitForTimeout(280);
  await p.screenshot({ path: `shots/kerb-${tag}-${i}.png` });
  console.log(`  car at (${c.x}, ${c.z}) -> shots/kerb-${tag}-${i}.png`);
  i++;
}
await b.close();
