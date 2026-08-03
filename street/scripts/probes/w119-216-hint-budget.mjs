// Item 216 (2) — WHAT DOES THE ATM CAPTION ACTUALLY OVERLAP, AND AT WHAT WIDTH?
//
// w109's probe measured the caption box at one viewport. This one sweeps the
// viewport, screenshots the PIN screen (the LONGEST hint), and projects the
// physical keypad's own corners onto the screen so an overlap with the CLR/0/ENT
// row is MEASURED rather than eyeballed — `ct/atm.ts:792` claims one.
//
// Usage: SHOT_URL=http://localhost:4750/ node scripts/probes/w119-216-hint-budget.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4750/');
const SIZES = (process.env.SIZES ?? '1280x800,1920x1080,1024x640,800x600').split(',')
  .map((s) => s.split('x').map(Number));

const b = await chromium.launch();
const errs = [];

for (const [width, height] of SIZES) {
  const p = await b.newPage({ viewport: { width, height } });
  p.on('console', (m) => { if (m.type() === 'error') errs.push(`${width}x${height} ${m.text()}`); });
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
  await waitPainted(p);
  await p.waitForTimeout(500);

  const atm = await p.evaluate(() => (window.__ct.spots?.() ?? [])
    .map((s) => ({ label: String(typeof s.label === 'function' ? s.label() : s.label), x: s.x, z: s.z }))
    .find((s) => /use the machine/i.test(s.label)));
  await p.evaluate(([x, z]) => window.__ct.warp(x, z, Math.PI / 2, 0, 0), [atm.x, atm.z]);
  await p.waitForTimeout(600);
  await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
  await p.waitForTimeout(1400);
  await p.keyboard.press('1');                       // INSERT CARD → the PIN screen
  await p.waitForTimeout(700);

  const m = await p.evaluate(() => {
    const wrap = document.getElementById('ct-atm');
    const cap = wrap?.lastElementChild;
    const r = cap.getBoundingClientRect();
    // one line of this font is 13 * 1.4 = 18.2 px; anything taller has WRAPPED
    const lines = Math.round(r.height / 18.2);
    // where the keypad's CLR/0/ENT row lands on screen, from the machine's own
    // uv (BUILDER-BRIEF §8 — asked for, never retyped)
    const three = window.__three ?? null;
    return {
      screen: window.__atm.screen(),
      cap: { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1),
             right: +r.right.toFixed(1), bottom: +r.bottom.toFixed(1) },
      text: cap.textContent,
      lines,
      vw: window.innerWidth, vh: window.innerHeight,
      hasThree: !!three,
    };
  });
  console.log(`${width}x${height}  lines=${m.lines}  cap.w=${m.cap.w}  x=${m.cap.x}..${m.cap.right}`
    + `  y=${m.cap.y}..${m.cap.bottom}  screen=${m.screen}`);
  console.log(`          "${m.text}"`);
  await p.screenshot({ path: `shots/w119-216-pin-${width}x${height}.png` });
  await p.close();
}

console.log(`console errors: ${errs.length}`);
for (const e of errs.slice(0, 5)) console.log('  ' + e);
await b.close();
