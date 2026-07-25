import { chromium } from 'playwright';
// diner: cx=440, cz=0, W=8.6 D=7.0 -> hd=3.5, T=0.18, door at local x=-2.6 w=1.15
// way-out spot = (cx-2.6, hd-0.55) = (437.4, 2.95); arrive = (437.4, 2.35)
// outside blocker spans z = hd+T .. hd+T+0.18 = 3.68 .. 3.86
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
console.error(`[measuring ${process.env.SHOT_URL ?? 'http://localhost:4184/'}]`);   // say WHICH world — 24163f69
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(1000);
const r = await p.evaluate(async () => {
  const out = [];
  const readPrompt = () => { // read text AND whether the HUD row is actually showing
    const n = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && /\[E\]/.test(e.textContent ?? ''));
    if (!n) return null;
    let vis = true;
    for (let e = n; e && e !== document.body; e = e.parentElement)
      if (getComputedStyle(e).display === 'none' || getComputedStyle(e).visibility === 'hidden') vis = false;
    return { txt: n.textContent.trim(), showing: vis };
  };
  const at = async (x, z, gy, label) => {
    window.__ct.warp(x, z, 0, gy, 0); await new Promise(r => setTimeout(r, 400));
    return { label, prompt: readPrompt() };
  };
  out.push(await at(437.4, 2.95, 0, 'diner way-OUT spot (computed)'));
  out.push(await at(437.4, 2.35, 0, 'diner ARRIVAL point'));
  out.push(await at(440, 0, 0, 'middle of the diner'));
  // walk out through the doorway itself
  window.__ct.warp(437.4, 1.5, Math.PI, 0, 0);
  await new Promise(r => setTimeout(r, 150));
  for (let i = 0; i < 300; i++) { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
    await new Promise(r => requestAnimationFrame(r)); }
  window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }));
  const q = window.__ct.pos();
  out.push({ label: 'walked +z through the doorway from inside',
             endedAt: [+q[0].toFixed(2), +q[2].toFixed(2)],
             frontWallInnerFace: 3.5, blockerFarFace: 3.86 });
  return out;
});
for (const x of r) console.log(JSON.stringify(x));
await p.evaluate(() => window.__ct.warp(437.4, 2.2, Math.PI, 0, 0.05));
await p.waitForTimeout(300); await p.screenshot({ path: 'shots/int-diner-doorway.png' });
await b.close();
