// H (verifier): K's NEW station — sleep in 301 for real, not via __hud.fade().
// "stand at (197.05, -17.20) in room 301, press E, and watch the SCREEN rather
// than the clock." K found it by sweeping because C's TV seat wins the pick
// from about half the squares around the bed.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4187/';
const S = [197.05, -17.20];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 640, height: 400 } });
p.on('pageerror', (e) => console.log('  PAGE ERROR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.warp, null, { timeout: 60000 });
const prompt = () => p.evaluate(() => (document.body.innerText.match(/\[E\][^\n]*/) || [''])[0]);
const clock = () => p.evaluate(() => window.__ct.clockNow ? window.__ct.clockNow() : null);
// CLICK FIRST, THEN WARP. The HUD says "click to look" - the click I use for
// keyboard focus is ALSO a look input, so clicking after the warp rotated me off
// the facing I had just set, and the sleep spot lost the pick again.
await p.mouse.click(320, 200); await p.waitForTimeout(250);
// yaw PI: the ONE facing of twelve at this station that picks the sleep spot
await p.evaluate(([x, z]) => window.__ct.warp(x, z, Math.PI, window.__ct.groundAt(x, z), 0), S);
await p.waitForTimeout(700);
console.log(`stood at (${S}) — prompt: ${await prompt() || '(nothing)'}`);
console.log(`clock before: ${JSON.stringify(await clock())}`);
await p.keyboard.press('KeyE');
// capture through the fade; a flat black frame compresses to almost nothing
const sizes = [];
for (const dt of [300, 300, 300, 300, 300, 400, 500, 600]) {
  await p.waitForTimeout(dt);
  const f = `shots/H-sleep301-${sizes.length}.png`;
  await p.screenshot({ path: f });
  const { size } = await import('node:fs').then((m) => m.statSync(f));
  sizes.push(size);
}
console.log(`frame bytes through the fade: ${sizes.join(', ')}`);
const darkest = Math.min(...sizes), normal = Math.max(...sizes);
console.log(`  darkest ${darkest} B, brightest ${normal} B  ratio ${(normal / darkest).toFixed(1)}x`);
console.log(`clock after: ${JSON.stringify(await clock())}`);
console.log(darkest < 4000 ? '\n  the screen went to (near) black during the sleep.'
                           : '\n  no frame went dark — the fade did not happen here.');
await b.close();
