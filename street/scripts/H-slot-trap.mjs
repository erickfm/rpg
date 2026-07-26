// H: seated at a slot, E shows "[E] stand up" but does not stand you up.
// What DOES it do? Hypothesis: it opens the slot machine panel instead.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4187/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats, null, { timeout: 60000 });
await p.mouse.click(400, 250); await p.waitForTimeout(250);
const st = () => p.evaluate(() => ({
  seated: !!window.__ct.seated(),
  panel: window.__hud && window.__hud.panel ? window.__hud.panel() : 'no-accessor',
  prompt: (document.body.innerText.match(/\[E\][^\n]*/) || [''])[0] || null,
}));
const s = await p.evaluate(() => {
  const q = window.__ct.seats().find((x) => /slot/i.test(x.label));
  return { x: q.pose.x, z: q.pose.z, ax: q.at.x, az: q.at.z };
});
await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, window.__ct.groundAt(x, z), 0),
  [s.ax, s.az, Math.atan2(s.x - s.ax, -(s.z - s.az))]);
await p.waitForTimeout(400);
console.log('standing at the approach: ', JSON.stringify(await st()));
await p.keyboard.press('KeyE'); await p.waitForTimeout(700);
console.log('after E #1 (sit):        ', JSON.stringify(await st()));
await p.keyboard.press('KeyE'); await p.waitForTimeout(800);
console.log('after E #2 (expect stand):', JSON.stringify(await st()));
await p.keyboard.press('Escape'); await p.waitForTimeout(600);
console.log('after ESC:               ', JSON.stringify(await st()));
await p.keyboard.press('KeyE'); await p.waitForTimeout(800);
console.log('after E #3:              ', JSON.stringify(await st()));
await b.close();
