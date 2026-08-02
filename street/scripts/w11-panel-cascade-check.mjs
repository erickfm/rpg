import { chromium } from 'playwright';
const URL = process.env.SHOT_URL;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 25000 });
const press = async (k, ms = 90) => {
  await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); await p.waitForTimeout(170);
};
const slot = (await p.evaluate(() => window.__ct.seats().filter((s) => s.label === 'sit at the slot')))[0];
await p.evaluate((q) => window.__ct.warp(q.at.x, q.at.z, 0, window.__ct.pos()[1] ?? 0, 0), slot);
await p.waitForTimeout(200);
await press('e'); // sit -> opens slots panel
console.log('after sit:', await p.evaluate(() => ({ seated: window.__ct.seated() !== null, panel: window.__hud?.panel?.() })));
await press('e'); // mimic seats-walk's stand-attempt: swallowed by panel
console.log('after E-stand-attempt:', await p.evaluate(() => ({ seated: window.__ct.seated() !== null, panel: window.__hud?.panel?.() })));
// mimic seats-walk's own "reset" (bypass call)
await p.evaluate(() => window.__ct.stand && window.__ct.stand());
await p.waitForTimeout(80);
console.log('after __ct.stand() bypass:', await p.evaluate(() => ({ seated: window.__ct.seated() !== null, panel: window.__hud?.panel?.() })));
// now try to sit at a totally unrelated seat (a bench) to see if E is still swallowed
const bench = (await p.evaluate(() => window.__ct.seats().filter((s) => s.label === 'sit down')))[0];
await p.evaluate((q) => window.__ct.warp(q.at.x, q.at.z, 0, window.__ct.pos()[1] ?? 0, 0), bench);
await p.waitForTimeout(200);
const promptAtBench = await p.evaluate(() => {
  const d = document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? d.textContent.trim() : null;
});
await press('e');
console.log('bench prompt:', promptAtBench, ' after E at bench:',
  await p.evaluate(() => ({ seated: window.__ct.seated() !== null, panel: window.__hud?.panel?.() })));
await b.close();
