// One-shot: what IS the world's panel roster, and can each member be opened
// cold, from spawn, with no walking? Sizing measurement for item 199's
// population floor. Usage: SHOT_URL=http://localhost:4650/ node scripts/probes/w109-panel-roster.mjs
import { chromium } from 'playwright';
import { waitPainted } from '../lib/painted.mjs';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4650/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await waitPainted(p);
await p.waitForTimeout(600);

const roster = await p.evaluate(() => window.__hud.panels());
console.log('roster', roster.length, JSON.stringify(roster));

const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));

const res = [];
for (const id of roster) {
  const before = errs.length;
  const opened = await p.evaluate((i) => window.__hud.openPanel(i), id);
  // WAS IT EVER UP? poll immediately, then again after the ease, so a panel
  // that raises and self-closes is told apart from one that never raised.
  const at0 = await p.evaluate(() => window.__hud.panel());
  await p.waitForTimeout(250);
  const at250 = await p.evaluate(() => window.__hud.panel());
  await p.waitForTimeout(750);
  const at1000 = await p.evaluate(() => window.__hud.panel());
  await p.evaluate(() => window.__hud.closePanels());
  await p.waitForTimeout(200);
  const after = await p.evaluate(() => window.__hud.panel());
  res.push({ id, opened, at0, at250, at1000, closed: after === null, newErrs: errs.length - before });
}
console.table(res);
console.log(`console errors: ${errs.length}`);
for (const e of errs.slice(0, 12)) console.log('   ', e);
await b.close();
