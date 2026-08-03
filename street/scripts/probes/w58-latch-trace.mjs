// Throwaway: watch the panel state through a leaned-on [E] at the ATM.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const URL = aim('http://localhost:4192/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERR:', m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct && window.__hud, { timeout: 20000 });

const spots = await p.evaluate(() => window.__ct.spots());
const atm = spots.find((s) => /FIRST FEDERAL — use the machine/.test(s.label));
await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y), [atm.x, atm.z - 0.6, Math.PI]);
await p.waitForTimeout(300);
console.log('prompt:', await p.evaluate(() => document.getElementById('ct-prompt')?.textContent));

const snap = async (t) => {
  const s = await p.evaluate(() => ({
    panel: window.__hud.panel(),
    seated: window.__ct.seated(),
    atm: window.__atm?.screen?.() ?? null,
    held: window.__hud.held?.(),
    latched: window.__hud.latched?.(),
  }));
  console.log(`${String(t).padStart(5)}ms  panel=${s.panel}  held=[${s.held}]  latched=${s.latched}  seated=${!!s.seated}`);
};

console.log('--- down e, then repeats ---');
await p.keyboard.down('e');
let t = 0;
for (let i = 0; i < 9; i++) {
  await p.waitForTimeout(45); t += 45;
  await snap(t);
  await p.keyboard.down('e');
}
await p.waitForTimeout(45); t += 45;
await p.keyboard.up('e');
console.log('--- released ---');
for (const w of [50, 100, 200, 400]) { await p.waitForTimeout(w); t += w; await snap(t); }
await b.close();
