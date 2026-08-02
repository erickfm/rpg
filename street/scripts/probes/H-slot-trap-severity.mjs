// H (verifier): I's row says a slot sitter "cannot leave by any key, and
// reloading is the only exit". My trace disagrees, so this tests each key on
// its own and sizes the label, because severity decides priority here.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const URL = aim('http://localhost:4187/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
p.on('pageerror', (e) => console.log('  PAGE ERROR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats, null, { timeout: 60000 });
await p.mouse.click(400, 250); await p.waitForTimeout(250);
const st = () => p.evaluate(() => ({
  seated: !!window.__ct.seated(),
  panel: window.__hud?.panel ? window.__hud.panel() : '?',
  prompt: (document.body.innerText.match(/\[E\][^\n]*/) || [''])[0] || null,
}));
const seats = await p.evaluate(() => {
  const all = window.__ct.seats();
  const by = {};
  for (const s of all) by[s.label] = (by[s.label] ?? 0) + 1;
  const slot = all.find((s) => /sit at the slot/i.test(s.label));
  return { total: all.length, by, slot: slot ? { x: slot.pose.x, z: slot.pose.z, ax: slot.at.x, az: slot.at.z } : null };
});
const top = Object.entries(seats.by).sort((a, c) => c[1] - a[1]).slice(0, 4);
console.log(`${seats.total} seats in the world; largest labels: ${top.map(([l, n]) => `${l}=${n}`).join(', ')}`);
console.log(`  I's figures: 96 of 225 are "sit at the slot" (43%), next largest "sit down" 38, the bed 1`);
const sit = async () => {
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, window.__ct.groundAt(x, z), 0),
    [seats.slot.ax, seats.slot.az, Math.atan2(seats.slot.x - seats.slot.ax, -(seats.slot.z - seats.slot.az))]);
  await p.waitForTimeout(350);
  await p.keyboard.press('KeyE'); await p.waitForTimeout(700);
  return (await st()).seated;
};
for (const key of ['KeyE', 'Escape', 'KeyQ', 'Backspace']) {
  if (!await sit()) { console.log(`  could not sit for ${key}`); continue; }
  const before = await st();
  await p.keyboard.press(key); await p.waitForTimeout(800);
  const after = await st();
  console.log(`  seated + panel ${before.panel} -> press ${key.padEnd(9)} -> seated=${after.seated} panel=${after.panel}` +
              `${after.seated ? '' : '   <-- THIS KEY GETS YOU OUT'}`);
  if (after.seated) { await p.keyboard.press('Escape'); await p.waitForTimeout(600);
    if ((await st()).seated) { await p.keyboard.press('KeyE'); await p.waitForTimeout(600); } }
}
await b.close();
