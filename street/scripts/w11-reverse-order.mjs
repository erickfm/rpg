#!/usr/bin/env node
// The reverse of the 0f repro: blackjack -> stand -> slots -> sit. Item 0f
// asked for "the reverse order too".
//
//   SHOT_URL=http://localhost:4190/ node scripts/w11-reverse-order.mjs

import { chromium } from 'playwright';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('ABORTED: set SHOT_URL to your own preview.'); process.exit(3); }

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 25000 });

const prompt = () => p.evaluate(() => {
  const d = document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? (d.textContent ?? '').trim() : null;
});
const press = async (k, ms = 90) => {
  await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k);
  await p.waitForTimeout(170);
};
const waitPrompt = async (re) => {
  for (let t = 0; t < 60; t++) {
    const cur = await prompt();
    if (cur && re.test(cur)) return cur;
    await p.waitForTimeout(50);
  }
  return null;
};

const bj = (await p.evaluate(() => window.__ct.seats().filter((s) => s.label === 'sit at the blackjack table')))[0];
const slot = (await p.evaluate(() => window.__ct.seats().filter((s) => s.label === 'sit at the slot')))[0];

await p.evaluate((q) => window.__ct.warp(q.at.x, q.at.z, 0, window.__ct.pos()[1] ?? 0, 0), bj);
await waitPrompt(/sit at the blackjack table/);
await press('e');
const seatedBj = await p.evaluate(() => window.__ct.seated() !== null);

await press('Escape');
await p.waitForTimeout(300);
const seatedAfterStand = await p.evaluate(() => window.__ct.seated() !== null);

await p.evaluate((q) => window.__ct.warp(q.at.x, q.at.z, 0, window.__ct.pos()[1] ?? 0, 0), slot);
await waitPrompt(/sit at the slot/);
await press('e');
await p.waitForTimeout(300);
const seatedSlot = await p.evaluate(() => window.__ct.seated() !== null);
const panelSlot = await p.evaluate(() => window.__hud?.panel?.() ?? null);

console.log(JSON.stringify({ seatedBj, seatedAfterStand, seatedSlot, panelSlot }));
const ok = seatedBj && !seatedAfterStand && seatedSlot && panelSlot === 'ct-slots';
console.log(ok ? 'OK  reverse order works' : 'FAIL reverse order broken');
await b.close();
process.exit(ok ? 0 : 1);
