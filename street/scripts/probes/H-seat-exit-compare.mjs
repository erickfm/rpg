// H: the SAME harness against two seats - the bed (known good, I stood up off it
// earlier) and a casino slot stool. If one works and the other does not, the
// harness is not the variable.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const URL = aim('http://localhost:4187/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
p.on('pageerror', (e) => console.log('  PAGE ERROR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats, null, { timeout: 60000 });
await p.mouse.click(400, 250); await p.waitForTimeout(250);
const prompt = () => p.evaluate(() => (document.body.innerText.match(/\[E\][^\n]*/) || [''])[0]);
const seats = await p.evaluate(() => window.__ct.seats()
  .filter((s) => /slot|watch TV/i.test(s.label))
  .map((s) => ({ label: s.label, x: s.pose.x, z: s.pose.z, ax: s.at.x, az: s.at.z })));
for (const s of [seats.find((q) => /watch TV/i.test(q.label)), seats.find((q) => /slot/i.test(q.label))]) {
  console.log(`\n"${s.label}"  pose (${s.x.toFixed(2)}, ${s.z.toFixed(2)})  approach (${s.ax.toFixed(2)}, ${s.az.toFixed(2)})  offset ${Math.hypot(s.x-s.ax, s.z-s.az).toFixed(2)} m`);
  for (let i = 0; i < 2; i++) {
    await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, window.__ct.groundAt(x, z), 0),
      [s.ax, s.az, Math.atan2(s.x - s.ax, -(s.z - s.az))]);
    await p.waitForTimeout(400);
    const pre = await prompt();
    await p.keyboard.press('KeyE'); await p.waitForTimeout(700);
    const on = await p.evaluate(() => !!window.__ct.seated());
    const mid = await prompt();
    await p.keyboard.press('KeyE'); await p.waitForTimeout(800);
    const off = await p.evaluate(() => !!window.__ct.seated());
    console.log(`   ${i + 1}: sit-prompt ${JSON.stringify(pre)} -> seated=${on}, stand-prompt ${JSON.stringify(mid)} -> ${off ? 'STILL SEATED' : 'stood up'}`);
    if (off) { await p.keyboard.press('KeyE'); await p.waitForTimeout(600); }
  }
}
await b.close();
