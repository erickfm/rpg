// H: the user says the tyres clip inward on the pickup. That is a VISUAL claim -
// you can see tyre where body should be - and a bounding-box test cannot answer
// it, because a wheel is meant to sit inside the body's footprint. So look.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4187/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
p.on('pageerror', (e) => console.log('  PAGE ERROR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.scene, null, { timeout: 60000 });
// the pickup: the vehicle whose group holds a bed floor, else the widest
const t = await p.evaluate(() => {
  const root = window.__ct.scene(); root.updateMatrixWorld(true);
  let best = null;
  root.traverse((g) => {
    if (!g.userData || !g.userData.wheelbase) return;
    const e = g.matrixWorld.elements, x = e[12], z = e[14];
    if (Math.abs(x) > 60 || Math.abs(z) > 130 || (x === 0 && z === 0)) return;
    // wb 3.3 IS a pickup: spec.pickup.wheelZ 1.65 x 2. Prefer the STREET truck
    // over a lot car - the user says "the pickup", and the street one is the
    // one you walk past. Skip the hood-up car, whose bay is open by design.
    if (Math.abs(g.userData.wheelbase - 3.3) > 0.01) return;
    if (g.userData.hoodOpen) return;
    const onStreet = Math.abs(x) < 9;
    if (!best || (onStreet && !best.onStreet)) best = { x, z, wb: g.userData.wheelbase, onStreet };
  });
  return best;
});
console.log('on-street vehicle with the longest wheelbase:', JSON.stringify(t));
const shot = async (dx, dz, pitch, tag) => {
  const x = t.x + dx, z = t.z + dz;
  const yaw = Math.atan2(t.x - x, -(t.z - z));
  await p.evaluate(([a, c, y, pi]) => window.__ct.warp(a, c, y, window.__ct.groundAt(a, c), pi), [x, z, yaw, pitch]);
  await p.waitForTimeout(700);
  await p.screenshot({ path: `shots/H-pickup-${tag}.png` });
  console.log(`  ${tag}: stood at (${x.toFixed(2)}, ${z.toFixed(2)}) pitch ${pitch}`);
};
// down into the bed from above and behind, where an inboard tyre would show
await shot(-1.2, 2.6, -0.55, 'into-bed');
// low and square to the flank, where the arch meets the tyre
await shot(-2.6, 0, -0.10, 'flank-low');
// crouched at the wheel itself
await shot(-1.9, 1.4, -0.30, 'wheel-close');
await b.close();
