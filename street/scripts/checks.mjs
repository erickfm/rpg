// Targeted player checks — exactly the things the user has raised more than
// once. Not a code review: each one is "walk at it and see what happens".
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
await p.goto('http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);
const r = await p.evaluate(async () => {
  const showing = () => {
    const n = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && /\[E\]/.test(e.textContent ?? ''));
    if (!n) return null;
    for (let e = n; e && e !== document.body; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.display === 'none' || s.visibility === 'hidden') return null;
    }
    return n.textContent.trim();
  };
  const press = async (k, n) => {
    for (let i = 0; i < n; i++) { window.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
      await new Promise(r => requestAnimationFrame(r)); }
    window.dispatchEvent(new KeyboardEvent('keyup', { key: k }));
  };
  const look = (x, z, tx, tz) => Math.atan2(tx - x, -(tz - z));
  const out = [];
  const climb = async (fx, fz, tx, tz, label) => {
    window.__ct.warp(fx, fz, look(fx, fz, tx, tz), 0.14, 0);
    await new Promise(r => setTimeout(r, 150));
    const y0 = window.__ct.pos()[3];
    await press('w', 26);
    const q = window.__ct.pos();
    out.push({ check: label, startGy: +y0.toFixed(2), endGy: +q[3].toFixed(2),
      rose: +(q[3] - y0).toFixed(2), endedAt: [+q[0].toFixed(1), +q[2].toFixed(1)], prompt: showing() });
  };
  const line = async (x0, x1, z0, z1, n, gy, label) => {
    const seen = {};
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      window.__ct.warp(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, 0, gy, 0);
      await new Promise(r => requestAnimationFrame(r));
      await new Promise(r => requestAnimationFrame(r));
      const s = showing(); if (s) seen[s] = (seen[s] ?? 0) + 1;
    }
    out.push({ check: label, prompts: seen });
  };
  await climb(-5.6, -13, -6.9, -13, 'LIBRARY steps from the pavement');
  await climb(2, -104, 2, -110, 'CHURCH steps from the side street');
  await climb(9, -30, 16, -30, 'CAR LOT: walk in from the street');
  await line(-6.5, -6.5, -2, -24, 50, 0.14, 'library frontage');
  await line(-13, -13, -95, -62, 50, 0.14, 'park interior');
  await line(10, 30, -30, -30, 40, 0.14, 'car lot interior');
  await line(-5.6, -5.6, -30, -45, 35, 0.14, 'bus bench area');
  await line(196, 206, -17, -17, 25, 5.4, 'room 301, floor 3');
  return out;
});
for (const x of r) console.log(JSON.stringify(x));
await b.close();
