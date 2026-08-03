// Item 277, step 1 — CONFIRM THE DESK'S LEAD BY DRIVING IT, on the real
// overlays, with a real pointer. The row says "nothing re-acquires the lock
// when a panel closes" and offers it as a lead, not a verdict.
//
// Usage: SHOT_URL=http://localhost:4650/ node scripts/probes/w109-confirm-277.mjs
import { chromium } from 'playwright';
import { waitPainted } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4650/';
// The five landed diegetic overlays the row names, by the LABEL of the spot
// that raises each — never by a coordinate typed here.
const WANT = [
  [/use the machine/i, 'ATM (86)'],
  [/open your mailbox/i, 'mail (155)'],
  [/read the loan application/i, 'loan (185)'],
  [/sit at the computer/i, 'library PC (157)'],
  [/sit at the slot/i, 'slots (100)'],
];

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await waitPainted(p);
await p.waitForTimeout(700);

const spots = await p.evaluate(() => (window.__ct.spots?.() ?? []).map((s) => ({
  label: String(typeof s.label === 'function' ? s.label() : s.label), x: s.x, z: s.z,
})));
const locked = () => p.evaluate(() => document.pointerLockElement === document.querySelector('canvas'));
const panel = () => p.evaluate(() => window.__hud?.panel?.() ?? null);
const click = async () => { await p.mouse.move(640, 400); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(350); };
const pressE = async () => { await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e'); await p.waitForTimeout(1300); };

const rows = [];
for (const [re, name] of WANT) {
  const s = spots.find((q) => re.test(q.label));
  if (!s) { rows.push({ overlay: name, note: 'SPOT NOT FOUND' }); continue; }
  await p.evaluate(() => window.__hud.closePanels());
  await p.waitForTimeout(400);
  await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [s.x, s.z]);
  await p.waitForTimeout(600);
  await click();
  const lockBefore = await locked();
  await pressE();
  const id = await panel();
  const lockWhileUp = await locked();
  await p.keyboard.press('Escape');
  await p.waitForTimeout(1000);
  const closed = (await panel()) === null;
  const lockAfterEsc = await locked();
  rows.push({ overlay: name, spot: s.label, id, lockBefore, lockWhileUp, closed, lockAfterEsc });
}
console.table(rows);
console.log(`console errors: ${errs.length}`);
for (const e of errs.slice(0, 6)) console.log('   ', e);
await b.close();
