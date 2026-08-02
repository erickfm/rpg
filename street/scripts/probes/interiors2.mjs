import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
await p.goto(aim('http://localhost:4184/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, aim('http://localhost:4184/'));   // GOTCHAS 26: prove it, do not just name it
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(1000);
// 1. does the diner prompt fire when you STAND on the spot? (warp, not walk)
const r1 = await p.evaluate(async () => {
  const read = () => [...document.querySelectorAll('*')]
    .filter(n => n.children.length === 0 && /\[E\]/.test(n.textContent ?? ''))
    .map(n => ({ txt: n.textContent.trim(), vis: n.offsetParent !== null,
                 disp: getComputedStyle(n).display, op: getComputedStyle(n).opacity }));
  const at = async (x, z, gy, label) => {
    window.__ct.warp(x, z, 0, gy, 0);
    await new Promise(r => setTimeout(r, 400));
    return { label, pos: window.__ct.pos().map(v => +v.toFixed(2)), prompts: read() };
  };
  return [
    await at(-6.55, 9.6, 0.14, 'ON the diner way-in spot'),
    await at(-6.34, 9.6, 0.14, 'where the walk test stopped'),
    await at(8.7, -96.85, 0.14, 'ON the bodega way-in spot (known good)'),
    await at(440, 6.5 - 1.15, 0, 'inside the diner, on the way-out spot'),
  ];
});
console.log('=== PROMPT PROBE ===');
for (const x of r1) console.log(JSON.stringify(x));
// 2. can you walk OUT of the diner through its own doorway into dead slab?
const r2 = await p.evaluate(async () => {
  window.__ct.warp(440, 2.0, Math.PI, 0, 0);   // inside, facing the door (+z)
  await new Promise(r => setTimeout(r, 150));
  for (let i = 0; i < 260; i++) { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
    await new Promise(r => requestAnimationFrame(r)); }
  window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }));
  const q = window.__ct.pos();
  return { endedAt: q.map(v => +v.toFixed(2)), note: 'room front wall is at local z=+3.5 -> world z=3.5' };
});
console.log('\n=== WALK OUT THE DINER DOOR ===');
console.log(JSON.stringify(r2));
await p.evaluate(() => window.__ct.warp(440, 2.0, Math.PI, 0, 0));
await p.waitForTimeout(300); await p.screenshot({ path: 'shots/int-diner-door.png' });
await p.evaluate(() => window.__ct.warp(415, 0, Math.PI/2, 0, -0.5));
await p.waitForTimeout(300); await p.screenshot({ path: 'shots/int-deadslab.png' });
await p.evaluate(() => window.__ct.warp(440, -2.0, 0, 0, 0.1));
await p.waitForTimeout(300); await p.screenshot({ path: 'shots/int-diner-back.png' });
await p.evaluate(() => window.__ct.warp(440, 1.5, Math.PI, 0, 0.15));
await p.waitForTimeout(300); await p.screenshot({ path: 'shots/int-diner-front.png' });
await p.evaluate(() => window.__ct.warp(244, -15, Math.PI/2, 0, 0.1));
await p.waitForTimeout(300); await p.screenshot({ path: 'shots/int-bodega-cmp.png' });
await b.close();
