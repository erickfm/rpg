// H: control for the slot-exit test. Does E get you off the stool when nothing
// touches the player between sitting and standing? My previous run warped the
// camera WHILE SEATED to change facing, which may itself be the fault.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4187/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats, null, { timeout: 60000 });
await p.mouse.click(400, 250); await p.waitForTimeout(250);
const prompt = () => p.evaluate(() => (document.body.innerText.match(/\[E\][^\n]*/) || [''])[0]);
const seat = await p.evaluate(() => {
  const s = window.__ct.seats().find((q) => /slot/i.test(q.label));
  return { x: s.pose.x, z: s.pose.z, ax: s.at.x, az: s.at.z };
});
const sit = async () => {
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, window.__ct.groundAt(x, z), 0),
    [seat.ax, seat.az, Math.atan2(seat.x - seat.ax, -(seat.z - seat.az))]);
  await p.waitForTimeout(350);
  await p.keyboard.press('KeyE'); await p.waitForTimeout(650);
  return p.evaluate(() => !!window.__ct.seated());
};
console.log('A) sit, then E immediately — NOTHING touched in between:');
for (let i = 0; i < 3; i++) {
  const on = await sit();
  const t1 = await prompt();
  await p.keyboard.press('KeyE'); await p.waitForTimeout(700);
  const still = await p.evaluate(() => !!window.__ct.seated());
  console.log(`   ${i + 1}: seated=${on}  prompt ${JSON.stringify(t1)}  after E -> ${still ? 'STILL SEATED' : 'stood up'}`);
  if (still) { await p.keyboard.press('KeyE'); await p.waitForTimeout(500); }
}
console.log('\nB) sit, then WARP to the same yaw (a no-op warp), then E:');
for (let i = 0; i < 2; i++) {
  const on = await sit();
  await p.evaluate(() => { const q = window.__ct.pos(); window.__ct.warp(q[0], q[2], window.__ct.yaw(), window.__ct.groundAt(q[0], q[2]), 0); });
  await p.waitForTimeout(350);
  const seatedAfterWarp = await p.evaluate(() => !!window.__ct.seated());
  const t1 = await prompt();
  await p.keyboard.press('KeyE'); await p.waitForTimeout(700);
  const still = await p.evaluate(() => !!window.__ct.seated());
  console.log(`   ${i + 1}: seated=${on}  seated after no-op warp=${seatedAfterWarp}  prompt ${JSON.stringify(t1)}  after E -> ${still ? 'STILL SEATED' : 'stood up'}`);
  if (still) { await p.keyboard.press('KeyE'); await p.waitForTimeout(500); }
}
await b.close();
