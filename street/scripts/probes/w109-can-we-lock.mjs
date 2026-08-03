// Item 277, step 0 — CAN THIS BROWSER LOCK THE POINTER AT ALL?
//
// Everything item 277 asks is a question about `document.pointerLockElement`.
// If a headless chromium refuses to lock, every measurement below it reports
// "the mouse is dead" for a reason that has nothing to do with the world — the
// GOTCHAS 48 failure, wearing pointer-lock clothes. So this is asked FIRST and
// on its own, before anything is concluded about any exit path.
//
// Usage: SHOT_URL=http://localhost:4650/ node scripts/probes/w109-can-we-lock.mjs
import { chromium } from 'playwright';
import { waitPainted } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4650/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await waitPainted(p);
await p.waitForTimeout(600);

const state = () => p.evaluate(() => ({
  lockEl: document.pointerLockElement ? document.pointerLockElement.tagName : null,
  isCanvas: document.pointerLockElement === document.querySelector('canvas'),
}));

console.log('before any click:', JSON.stringify(await state()));

// A REAL POINTER, not `dispatchEvent`. requestPointerLock needs a genuine user
// gesture, and a synthetic MouseEvent does not carry one.
await p.mouse.move(640, 400);
await p.mouse.down();
await p.mouse.up();
await p.waitForTimeout(500);
console.log('after a real canvas click:', JSON.stringify(await state()));

// …and can we re-lock from script, with no gesture at all? That is what the
// fix at the close path would be doing on the ATM's farewell TIMEOUT.
await p.evaluate(() => document.exitPointerLock());
await p.waitForTimeout(300);
console.log('after exitPointerLock:', JSON.stringify(await state()));
const threw = await p.evaluate(async () => {
  try { const r = document.querySelector('canvas').requestPointerLock(); if (r?.catch) await r; return null; }
  catch (e) { return String(e); }
});
await p.waitForTimeout(500);
console.log('after a SCRIPTED re-lock (no gesture):', JSON.stringify(await state()), 'threw:', threw);

console.log(`console errors: ${errs.length}`);
for (const e of errs.slice(0, 6)) console.log('   ', e);
await b.close();
