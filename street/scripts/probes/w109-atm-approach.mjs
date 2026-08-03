// Item 277 — the ATM spot did not raise its panel at yaw 0. Which way must the
// player be facing? (GOTCHAS 88: a spot at the centre of a deep object is
// invisible to canSee; the yaw is not decoration.)
// Usage: SHOT_URL=http://localhost:4650/ node scripts/probes/w109-atm-approach.mjs
import { chromium } from 'playwright';
import { waitPainted } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4650/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await waitPainted(p);
await p.waitForTimeout(700);

const spots = await p.evaluate(() => (window.__ct.spots?.() ?? []).map((s) => ({
  label: String(typeof s.label === 'function' ? s.label() : s.label), x: s.x, z: s.z,
})));
const atm = spots.filter((s) => /use the machine/i.test(s.label));
console.log('ATM spots:', JSON.stringify(atm));

const panel = () => p.evaluate(() => window.__hud?.panel?.() ?? null);
const prompt = () => p.evaluate(() => {
  const el = document.getElementById('ct-prompt');
  return el && getComputedStyle(el).display !== 'none' ? el.textContent : null;
});

for (const s of atm) {
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    await p.evaluate(() => window.__hud.closePanels());
    await p.waitForTimeout(350);
    await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0), [s.x, s.z, yaw]);
    await p.waitForTimeout(600);
    const pr = await prompt();
    await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
    await p.waitForTimeout(1300);
    console.log(`(${s.x}, ${s.z}) yaw ${yaw.toFixed(2)}  prompt=${JSON.stringify(pr)}  panel=${await panel()}`);
  }
}
await b.close();
