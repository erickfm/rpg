// EXIT AUDIT — "how you get back out to the street, and where you land when
// you do" (queue bullet). Rounds 1-6 walked only the diner's. This walks all
// three rooms that are in the world: stand on the way-out spot, press E, and
// check where you actually end up — is it on the walk, is it clear of the way-in
// trigger, and can you move once you are there.
import { chromium } from 'playwright';
// slab centres: diner 440, burger 520, thrift 600.  hd = d/2
const ROOMS = [
  { id: 'DINER',       cx: 440, d: 7.0, at: -2.6, inX: -6.55, inZ: 9.6,     inR: 1.05 },
  { id: 'BURGER BARN', cx: 520, d: 8.5, at: -3.6, inX: -6.55, inZ: -28.25,  inR: 1.05 },
  { id: 'THRIFT',      cx: 600, d: 6.5, at: -2.2, inX: -6.55, inZ: -74.94,  inR: 1.05 },
];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
await p.goto('http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);
const out = await p.evaluate(async (ROOMS) => {
  const res = [];
  const showing = () => {
    const n = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && /\[E\]/.test(e.textContent ?? ''));
    if (!n) return null;
    for (let e = n; e && e !== document.body; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.display === 'none' || s.visibility === 'hidden') return null;
    }
    return n.textContent.trim();
  };
  const tap = async (k) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
    await new Promise(r => setTimeout(r, 90));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: k }));
    await new Promise(r => setTimeout(r, 320));
  };
  for (const R of ROOMS) {
    const hd = R.d / 2;
    // stand on the way-out spot the kit computes: (cx + at, hd - 0.55)
    window.__ct.warp(R.cx + R.at, hd - 0.55, 0, 0, 0);
    await new Promise(r => setTimeout(r, 350));
    const promptInside = showing();
    await tap('e');
    const q = window.__ct.pos();
    const landed = [+q[0].toFixed(2), +q[2].toFixed(2)], gy = +q[3].toFixed(2);
    const promptOutside = showing();
    const distToWayIn = +Math.hypot(landed[0] - R.inX, landed[1] - R.inZ).toFixed(2);
    // can you move off the landing point?
    let free = 0;
    for (const k of ['w', 's', 'a', 'd']) {
      window.__ct.warp(landed[0], landed[1], 0, gy, 0);
      await new Promise(r => setTimeout(r, 60));
      const a0 = window.__ct.pos();
      for (let i = 0; i < 25; i++) { window.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
        await new Promise(r => requestAnimationFrame(r)); }
      window.dispatchEvent(new KeyboardEvent('keyup', { key: k }));
      const a1 = window.__ct.pos();
      if (Math.hypot(a1[0] - a0[0], a1[2] - a0[2]) > 0.15) free++;
    }
    res.push({ room: R.id, promptInside, landed, groundY: gy,
      onWalk: landed[0] > -7 && landed[0] < -5.06,
      distToWayInTrigger: distToWayIn, insideItsOwnTrigger: distToWayIn < R.inR,
      promptOnLanding: promptOutside, directionsFree: `${free}/4` });
  }
  return res;
}, ROOMS);
for (const r of out) console.log(JSON.stringify(r));
await b.close();
