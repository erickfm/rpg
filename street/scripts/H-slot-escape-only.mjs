// H: ONE clean test of the disputed claim - "cannot leave by any key, reloading
// is the only exit". Fresh page, sit once, press Escape once, read the state.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
const URL = aim('http://localhost:4187/');
for (const run of [1, 2, 3]) {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 700, height: 440 } });
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__ct?.seats, null, { timeout: 60000 });
  await p.mouse.click(350, 220); await p.waitForTimeout(250);
  const s = await p.evaluate(() => {
    const q = window.__ct.seats().find((x) => /sit at the slot/i.test(x.label));
    return { x: q.pose.x, z: q.pose.z, ax: q.at.x, az: q.at.z };
  });
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, window.__ct.groundAt(x, z), 0),
    [s.ax, s.az, Math.atan2(s.x - s.ax, -(s.z - s.az))]);
  await p.waitForTimeout(400);
  await p.keyboard.press('KeyE'); await p.waitForTimeout(800);
  const seated = await p.evaluate(() => !!window.__ct.seated());
  const panel = await p.evaluate(() => window.__hud?.panel?.() ?? '?');
  await p.keyboard.press('Escape'); await p.waitForTimeout(900);
  const after = await p.evaluate(() => ({ seated: !!window.__ct.seated(), panel: window.__hud?.panel?.() ?? '?' }));
  console.log(`run ${run}: sat=${seated} panel=${panel}  -> ONE Escape -> seated=${after.seated} panel=${after.panel}`);
  await b.close();
}
