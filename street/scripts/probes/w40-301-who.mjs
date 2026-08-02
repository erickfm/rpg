// The grid printed '?' at x 197.4/197.8, z -16.6/-16.2 — something other than
// the bed or the door wins there. Name it, and print the full tier arithmetic
// for a handful of cells, so the fix is aimed at a decision I have actually
// read rather than one I inferred from a letter on a map.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4188/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 620 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.waitForTimeout(2000);
await reportWorld(p, URL);

const gy = await p.evaluate(() => window.__ct.groundAt(199.36, -15.545));
await p.evaluate(([gy]) => window.__ct.warp(199.36, -15.545, 0, gy, 0), [gy]);
await p.waitForTimeout(600);

const prompt = () => p.evaluate(() => {
  const el = document.getElementById('ct-prompt');
  const t = (el?.textContent ?? '').trim();
  return t ? t.replace(/^\s*\[E\]\s*/, '') : null;
});

const CELLS = [
  [197.4, -16.6], [197.8, -16.6], [197.4, -16.2], [197.8, -16.2],
  [199.2, -17.0], [198.8, -16.6], [199.6, -16.6], [198.4, -16.2],
];
const spots = await p.evaluate(() => window.__ct.spots().filter((s) => s.ok && s.x > 190 && s.x < 210));
const door = spots.find((s) => /the door/i.test(s.label));
const yawTo = (fx, fz, tx, tz) => Math.atan2(tx - fx, -(tz - fz));

for (const [x, z] of CELLS) {
  await p.evaluate(([x, z, y, gy]) => window.__ct.warp(x, z, y, gy, 0), [x, z, yawTo(x, z, door.x, door.z), gy]);
  await p.waitForTimeout(200);
  const won = await prompt();
  // every candidate's tier arithmetic, from fp.ts's OWN constants
  const rows = await p.evaluate(async ([x, z, yaw]) => {
    const m = await import('/src/proto/fp.ts');
    const fx = Math.sin(yaw), fz = -Math.cos(yaw);
    return window.__ct.spots().filter((s) => s.ok).map((s) => {
      const dx = s.x - x, dz = s.z - z, d = Math.hypot(dx, dz);
      const offAxis = d < 1e-4 ? 0 : Math.abs(Math.atan2(fx * dz - fz * dx, fx * dx + fz * dz));
      return { label: s.label, d, r: s.r, offAxis,
        near: d < s.r + m.TOUCH_MARGIN,
        looked: d < 6 && offAxis < m.lookTolerance(s.r, d) };
    }).filter((q) => q.near || q.looked).sort((a, c) => a.d - c.d);
  }, [x, z, yawTo(x, z, door.x, door.z)]);
  console.log(`\n(${x.toFixed(1)}, ${z.toFixed(1)}) facing the door  ->  [E] ${won ?? '(none)'}`);
  for (const q of rows) {
    console.log(`    ${q.near ? 'NEAR' : '    '} ${q.looked ? 'LOOK' : '    '}  d=${q.d.toFixed(2)} r=${q.r} off=${(q.offAxis * 180 / Math.PI).toFixed(0)}deg  ${q.label}`);
  }
}
await b.close();
