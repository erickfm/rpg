// H (verifier): C's station names FOUR exits - "try E, Escape, movement and
// jump". I have covered E (12 of 12 facings) and Escape (3 of 3 fresh pages).
// This tests all four at the bed, each from a fresh sitting.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4187/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 760, height: 470 } });
p.on('pageerror', (e) => console.log('  PAGE ERROR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats, null, { timeout: 60000 });
await p.mouse.click(380, 235); await p.waitForTimeout(250);
const s = await p.evaluate(() => {
  const q = window.__ct.seats().find((x) => /watch TV/i.test(x.label));
  return { x: q.pose.x, z: q.pose.z, ax: q.at.x, az: q.at.z };
});
const sit = async () => {
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, window.__ct.groundAt(x, z), 0),
    [s.ax, s.az, Math.atan2(s.x - s.ax, -(s.z - s.az))]);
  await p.waitForTimeout(380);
  await p.keyboard.press('KeyE'); await p.waitForTimeout(700);
  return p.evaluate(() => !!window.__ct.seated());
};
const clear = async () => {
  for (const k of ['Escape', 'KeyE']) {
    if (!await p.evaluate(() => !!window.__ct.seated())) return;
    await p.keyboard.press(k); await p.waitForTimeout(500);
  }
};
for (const [name, act] of [
  ['E',        async () => { await p.keyboard.press('KeyE'); }],
  ['Escape',   async () => { await p.keyboard.press('Escape'); }],
  ['movement', async () => { await p.keyboard.down('KeyW'); await p.waitForTimeout(600); await p.keyboard.up('KeyW'); }],
  ['jump',     async () => { await p.keyboard.press('Space'); }],
]) {
  if (!await sit()) { console.log(`  ${name.padEnd(9)} could not sit`); continue; }
  await act();
  await p.waitForTimeout(800);
  const out = !await p.evaluate(() => !!window.__ct.seated());
  console.log(`  ${name.padEnd(9)} -> ${out ? 'LEFT the seat' : 'still seated'}`);
  await clear();
}
await b.close();
