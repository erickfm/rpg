// Does the blackjack panel ever fail to close when the player is stood up by
// something OTHER than the panel's own Escape? slots.ts closes unconditionally
// on `stool === null`; blackjack.ts's mirror gates the same close on
// `dismissed !== null` -- and `dismissed` is forced to null on the very same
// frame, one line above, whenever `seat === null`. So the guard can never be
// true. Verifying live rather than trusting the reading.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 25000 });
const press = async (k, ms = 90) => {
  await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); await p.waitForTimeout(170);
};
const state = () => p.evaluate(() => ({ seated: window.__ct.seated() !== null, panel: window.__hud?.panel?.() }));

const bj = (await p.evaluate(() => window.__ct.seats().filter((s) => s.label === 'sit at the blackjack table')))[0];
await p.evaluate((q) => window.__ct.warp(q.at.x, q.at.z, 0, window.__ct.pos()[1] ?? 0, 0), bj);
await p.waitForTimeout(200);
await press('e');
console.log('after sit:', await state());

// force-stand WITHOUT going through the panel's Escape/close path -- exactly
// what a room-transition jump does (crosstown.ts's jumpToImpl), and exactly
// what scripts/seats-walk.mjs's own reset step does.
await p.evaluate(() => window.__ct.stand && window.__ct.stand());
await p.waitForTimeout(500);   // several frames -- give the onFrame hook every chance
console.log('after external stand (500ms later):', await state());

// is E now dead everywhere? try an unrelated seat.
const bench = (await p.evaluate(() => window.__ct.seats().filter((s) => s.label === 'sit down')))[0];
await p.evaluate((q) => window.__ct.warp(q.at.x, q.at.z, 0, window.__ct.pos()[1] ?? 0, 0), bench);
await p.waitForTimeout(200);
const promptAtBench = await p.evaluate(() => {
  const d = document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? d.textContent.trim() : null;
});
await press('e');
console.log('bench prompt was:', promptAtBench, '  state after E at bench:', await state());
await b.close();
