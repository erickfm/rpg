// TRIGGER MARGIN AUDIT.
//
// crosstown.ts hand-writes the block's collision as blanket rectangles that
// span the whole street (238-240), independent of what any module draws. The
// player capsule is 0.36, so the west wall face at x = -6.7 stops you at
// -6.34 and the east wall face at 6.7 stops you at 6.34.
//
// Every street-side [E] trigger sits somewhere in that band. What matters is
// not whether the trigger CENTRE is reachable -- mostly it is not -- but how
// much of the trigger radius is left over once the wall has eaten its share.
// That leftover is the MARGIN, and it is what a later prop collider spends.
// The bodega became un-enterable exactly this way: blanket wall, then crates.
//
//   MARGIN = r - (closest the player can actually get)
//
// Reported per trigger, walked from several directions with real key input.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const TRIGGERS = [
  { id: 'DINER (kit room)',        x: -6.55,  z: 9.6,    r: 1.05, gy: 0.14, from: [[-6.2, 15], [-6.2, 4], [-4.2, 9.6]] },
  { id: 'No. 227 street door',     x: 6.55,   z: -44,    r: 1.05, gy: 0.14, from: [[6.2, -38], [6.2, -50], [4.2, -44]] },
  { id: 'BODEGA corner store',     x: 8.7,    z: -96.85, r: 1.10, gy: 0.14, from: [[14, -97], [8.7, -99.5], [4, -99.5]] },
  { id: 'BURGER BARN (kit room)',  x: -6.55,  z: -28.25, r: 1.05, gy: 0.14, from: [[-6.2, -22], [-6.2, -34], [-4.2, -28.25]] },
];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
await p.goto('http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);

const out = await p.evaluate(async (TRIGGERS) => {
  const look = (x, z, tx, tz) => Math.atan2(tx - x, -(tz - z));
  const showing = () => {
    const n = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && /\[E\]/.test(e.textContent ?? ''));
    if (!n) return null;
    for (let e = n; e && e !== document.body; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.display === 'none' || s.visibility === 'hidden') return null;
    }
    return n.textContent.trim();
  };
  const res = [];
  for (const T of TRIGGERS) {
    let best = Infinity, bestAt = null, prompt = null;
    for (const [fx, fz] of T.from) {
      window.__ct.warp(fx, fz, look(fx, fz, T.x, T.z), T.gy, 0);
      await new Promise(r => setTimeout(r, 130));
      for (let i = 0; i < 170; i++) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
        await new Promise(r => requestAnimationFrame(r));
        const q = window.__ct.pos();
        const d = Math.hypot(q[0] - T.x, q[2] - T.z);
        if (d < best) { best = d; bestAt = [+q[0].toFixed(2), +q[2].toFixed(2)]; }
        const s = showing(); if (s) prompt = s;
      }
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }));
    }
    res.push({ id: T.id, r: T.r, closest: +best.toFixed(2), closestAt: bestAt,
               margin: +(T.r - best).toFixed(2), marginPct: Math.round((T.r - best) / T.r * 100),
               centreReachable: best < 0.05, prompt });
  }
  return res;
}, TRIGGERS);

writeFileSync('shots/trigger-report.json', JSON.stringify(out, null, 2));
console.log('trigger'.padEnd(26), 'r'.padStart(5), 'closest'.padStart(8), 'MARGIN'.padStart(8), '  centre?  prompt');
for (const t of out)
  console.log(t.id.padEnd(26), String(t.r).padStart(5), String(t.closest).padStart(8),
    `${t.margin} (${t.marginPct}%)`.padStart(12), t.centreReachable ? ' reachable' : ' BLOCKED  ', t.prompt ?? '(none)');
await b.close();
