#!/usr/bin/env node
// ITEM 0f: "you cannot sit at blackjack after standing up from the slots."
// Reproduce with TWO different ways of standing up (E-key state-exit, and
// Escape-panel-close) to find out which path is actually broken, per
// BUILDER-BRIEF §7 ("find the number in the source before you believe it").
//
//   SHOT_URL=http://localhost:4190/ node scripts/w11-slots-then-blackjack.mjs

import { chromium } from 'playwright';

const URL = process.env.SHOT_URL;
if (!URL) {
  console.error('ABORTED: set SHOT_URL to your own preview.');
  process.exit(3);
}

const b = await chromium.launch();

const prompt = (p) => p.evaluate(() => {
  const d = document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? (d.textContent ?? '').trim() : null;
});
const press = async (p, k, ms = 90) => {
  await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k);
  await p.waitForTimeout(170);
};
const waitPrompt = async (p, re) => {
  for (let t = 0; t < 60; t++) {
    const cur = await prompt(p);
    if (cur && re.test(cur)) return cur;
    await p.waitForTimeout(50);
  }
  return null;
};

async function run(standWith) {
  const p = await b.newPage({ viewport: { width: 900, height: 560 } });
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 25000 });

  const stools = await p.evaluate(() => window.__ct.seats().filter((s) => s.label === 'sit at the slot'));
  const bj = await p.evaluate(() => window.__ct.seats().filter((s) => s.label === 'sit at the blackjack table'));
  if (stools.length < 1 || bj.length < 1) {
    console.error(`ABORTED: stools=${stools.length} blackjack=${bj.length}`);
    await p.close(); return null;
  }
  const s = stools[0], t = bj[0];

  // sit at the slot
  await p.evaluate((q) => window.__ct.warp(q.at.x, q.at.z, 0, window.__ct.pos()[1] ?? 0, 0), s);
  await waitPrompt(p, /sit at the slot/);
  await press(p, 'e');
  const seatedSlot = await p.evaluate(() => window.__ct.seated() !== null);

  // stand up
  if (standWith === 'e') {
    await press(p, 'e');
  } else {
    await press(p, 'Escape');
  }
  await p.waitForTimeout(300);
  const seatedAfterStand = await p.evaluate(() => window.__ct.seated() !== null);
  const panelAfterStand = await p.evaluate(() => window.__hud?.panel?.() ?? null);

  // walk to blackjack
  await p.evaluate((q) => window.__ct.warp(q.at.x, q.at.z, 0, window.__ct.pos()[1] ?? 0, 0), t);
  const bjPrompt = await waitPrompt(p, /sit at the blackjack table/);
  await press(p, 'e');
  await p.waitForTimeout(300);
  const seatedBj = await p.evaluate(() => window.__ct.seated() !== null);
  const panelBj = await p.evaluate(() => window.__hud?.panel?.() ?? null);

  // ONE MORE PRESS, to test the "exactly one edge lost" hypothesis from
  // notes/archive/L-for-C-escape-eats-the-next-E.md.
  let seatedBj2 = seatedBj, panelBj2 = panelBj;
  if (!seatedBj) {
    await press(p, 'e');
    await p.waitForTimeout(300);
    seatedBj2 = await p.evaluate(() => window.__ct.seated() !== null);
    panelBj2 = await p.evaluate(() => window.__hud?.panel?.() ?? null);
  }

  await p.close();
  return {
    standWith, seatedSlot, seatedAfterStand, panelAfterStand, bjPrompt: !!bjPrompt,
    seatedBj, panelBj, seatedBj2, panelBj2,
  };
}

for (const mode of ['e', 'Escape']) {
  const r = await run(mode);
  console.log(JSON.stringify(r));
}

await b.close();
