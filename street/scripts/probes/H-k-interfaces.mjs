// H (verifier): K's three interface rows, looked at rather than only asserted.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const URL = aim('http://localhost:4187/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
p.on('pageerror', (e) => console.log('  PAGE ERROR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.pos && window.__hud, null, { timeout: 60000 });
await p.mouse.click(480, 300); await p.waitForTimeout(300);
const mean = () => p.evaluate(async () => {
  const c = document.querySelector('canvas');
  const g = document.createElement('canvas'); g.width = 80; g.height = 50;
  g.getContext('2d').drawImage(c, 0, 0, 80, 50);
  const d = g.getContext('2d').getImageData(0, 0, 80, 50).data;
  let s = 0; for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i+1] + d[i+2]) / 3;
  return +(s / (d.length / 4) / 255).toFixed(4);
});
console.log('before fade, screen mean:', await mean());
await p.screenshot({ path: 'shots/H-k-fade-before.png' });
p.evaluate(() => window.__hud.fade({ mid: () => window.__ct.advanceClock(480, 0) })).catch(() => {});
let darkest = 1;
for (let i = 0; i < 26; i++) {
  await p.waitForTimeout(160);
  const m = await mean();
  if (m < darkest) { darkest = m; await p.screenshot({ path: 'shots/H-k-fade-black.png' }); }
}
console.log('darkest during fade:', darkest);
await p.waitForTimeout(2500);
console.log('after fade, screen mean:', await mean());
await p.screenshot({ path: 'shots/H-k-fade-after.png' });
// the two panels
await p.keyboard.press('KeyI'); await p.waitForTimeout(700);
await p.screenshot({ path: 'shots/H-k-pockets.png' });
console.log('pockets open:', await p.evaluate(() => !!document.body.innerText.match(/POCKET|INVENTOR/i)));
await p.keyboard.press('KeyI'); await p.waitForTimeout(500);
await p.evaluate(() => window.__atm.open()); await p.waitForTimeout(800);
await p.screenshot({ path: 'shots/H-k-atm.png' });
console.log('atm open:', await p.evaluate(() => !!document.body.innerText.match(/ATM|PIN|BALANCE|WITHDRAW/i)));
await b.close();
