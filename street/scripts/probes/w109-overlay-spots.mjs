// Item 277 — which spots in the world actually raise a panel, and does the
// pointer come back when it closes? A census, run before any fix, so the claim
// "nothing re-acquires the lock" is measured on every overlay rather than
// asserted from one grep.
//
// Usage: SHOT_URL=http://localhost:4650/ node scripts/probes/w109-overlay-spots.mjs
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
await p.waitForTimeout(700);

const spots = await p.evaluate(() => (window.__ct.spots?.() ?? []).map((s, i) => ({
  i, label: String(typeof s.label === 'function' ? s.label() : s.label), x: s.x, z: s.z,
})));
console.log(`${spots.length} spots in the world`);
// ONE PER DISTINCT LABEL. 282 spots is 40+ minutes of browser and most of them
// are the same bench eight times. The question is per KIND of interaction, so
// the population is the distinct labels, derived from the world rather than
// from a list of the six overlays somebody remembered.
const byLabel = new Map();
for (const s of spots) if (!byLabel.has(s.label)) byLabel.set(s.label, s);
const uniq = [...byLabel.values()];
console.log(`${uniq.length} DISTINCT labels`);
for (const s of uniq) console.log(`   [${s.i}] ${s.label}   (${s.x}, ${s.z})`);
if (process.env.LIST_ONLY) { await b.close(); process.exit(0); }

const locked = () => p.evaluate(() => document.pointerLockElement === document.querySelector('canvas'));
const panel = () => p.evaluate(() => window.__hud?.panel?.() ?? null);
const relock = async () => {
  await p.mouse.move(640, 400); await p.mouse.down(); await p.mouse.up();
  await p.waitForTimeout(350);
};
const pressE = async () => {
  await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
  await p.waitForTimeout(1200);
};

const rows = [];
for (const s of spots) {
  await p.evaluate(() => window.__hud.closePanels());
  await p.waitForTimeout(350);
  await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [s.x, s.z]);
  await p.waitForTimeout(500);
  await relock();
  const lockBefore = await locked();
  if (!lockBefore) { rows.push({ label: s.label, note: 'could not lock before opening' }); continue; }
  await pressE();
  const id = await panel();
  if (!id) continue;                       // this spot raises no panel
  const lockUp = await locked();
  await p.keyboard.press('Escape');
  await p.waitForTimeout(900);
  const rowsEsc = { closed: (await panel()) === null, lockAfter: await locked() };
  rows.push({ label: s.label, id, lockBefore, lockWhileUp: lockUp, ...rowsEsc });
}
console.log('');
console.table(rows);
console.log(`console errors: ${errs.length}`);
for (const e of errs.slice(0, 6)) console.log('   ', e);
await b.close();
