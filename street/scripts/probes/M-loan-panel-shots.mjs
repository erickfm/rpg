// PICTURES OF THE LOAN APPLICATION PANEL — an investigation, not an assertion.
// The claims about it live in `M-bank-int-walk.mjs`.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = aim('http://localhost:4204/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 760 } });
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

const R = await p.evaluate(() => (window.__ct.roomDims() || []).find((r) => r.id === 'bank'));
if (!R) { console.error('no bank room'); process.exit(3); }
await p.evaluate(() => window.__ct.clock(14, 20));
// stand at the desk, looking at the officer — the position a player arrives in
await p.evaluate(([cx, cz]) => window.__ct.warp(cx + 4.4, cz + 3.52, 0, 0, -0.04), [R.cx, R.cz]);
await p.waitForTimeout(400);
console.log('prompt at the desk:', await p.evaluate(() => {
  const d = document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? d.textContent : null;
}));

const press = async (k) => { await p.keyboard.press(k); await p.waitForTimeout(260); };
await press('e');
await p.screenshot({ path: 'shots/M-loan-panel-open.png' });
console.log('  M-loan-panel-open        (the sheet as it opens, $200)');
await press('w'); await press('w');
await p.screenshot({ path: 'shots/M-loan-panel-1000.png' });
console.log('  M-loan-panel-1000        ($1000, and the security it wants)');
await press('Enter');
await p.screenshot({ path: 'shots/M-loan-panel-declined.png' });
console.log('  M-loan-panel-declined    (DECLINED, and by how much)');
await press('s'); await press('s');
await press('Enter');
await p.screenshot({ path: 'shots/M-loan-panel-approved.png' });
console.log('  M-loan-panel-approved    (APPROVED at $200)');
await press('Escape');
await p.waitForTimeout(300);
await p.screenshot({ path: 'shots/M-loan-panel-after.png' });
console.log('  M-loan-panel-after       (back in the room, sent to window 2)');
await b.close();
