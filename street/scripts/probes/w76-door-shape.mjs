// One-shot (item 213): what exactly does __ct.doors() publish, and how close is
// each door's published stand/point to the nearest [E] spot? This is the
// measurement that decides whether a harness can key a room off its DECLARATION
// instead of off its user-facing label.
//   SHOT_URL=http://localhost:4320/ node scripts/probes/w76-door-shape.mjs
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? (() => { throw new Error('SHOT_URL required — GOTCHAS 50'); })();
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(800);
const raw = await p.evaluate(() => JSON.stringify(window.__ct.doors()[0]));
console.log('doors()[0] =', raw);
const rows = await p.evaluate(() => {
  const xz = (v) => (Array.isArray(v) ? { x: v[0], z: v[1] } : v ? { x: v.x, z: v.z } : null);
  const spots = window.__ct.spots();
  return window.__ct.doors().map((d) => {
    const st = xz(d.stand) ?? xz(d.point);
    let best = null, bd = Infinity;
    for (const s of spots) {
      const dd = Math.hypot(s.x - st.x, s.z - st.z);
      if (dd < bd) { bd = dd; best = s; }
    }
    return { b: d.building, sx: +st.x.toFixed(2), sz: +st.z.toFixed(2), d: +bd.toFixed(3), label: best?.label };
  });
});
for (const r of rows) console.log(`${r.b.padEnd(15)} stand ${r.sx},${r.sz}  nearest spot ${r.d} m -> "${r.label}"`);
await b.close();
