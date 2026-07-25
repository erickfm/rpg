// Does the world's night grading actually reach this module's materials?
//
// A screenshot cannot answer that: "the fence looks a bit bright" is not a
// measurement, and the failure it hides is silent. props.ts's dimWorld SKIPS
// any material with `transparent: true` — correct for glass, and it means any
// prop that sets that flag when it only needed `alphaTest` stands at full
// daylight brightness at midnight while everything behind it goes dark.
//
// So this averages material colour by CLASS, at noon and at 23:00, over a
// world-space box. What you want to see is every class falling except
// `additive` — those are lights, and a light that dims at night is backwards.
//
// The car lot read like this before the fix and after it:
//   13:00  opaque 0.415  translucent 0.684  alphaCut 1.000  additive 0.683
//   23:00  opaque 0.221  translucent 0.497  alphaCut 0.374  additive 0.683
// alphaCut pinned at 1.000 all night was the bug, in one line.
//
// Usage: SHOT_URL=http://localhost:4190/ node scripts/nightgrade.mjs [x0 x1 z0 z1]
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
const A = process.argv.slice(2).map(Number);
const BOX = A.length === 4 ? A : [-1e9, 1e9, -1e9, 1e9];
const probe = async (h) => {
  await p.evaluate(([hh]) => window.__ct.clock(hh, 0), [h]);
  await p.waitForTimeout(1000);
  return p.evaluate(([BOX]) => {
    const s = window.__ct.scene(); s.updateMatrixWorld(true); const out = {};
    s.traverse((o) => {
      if (!o.isMesh) return;
      const e = o.matrixWorld.elements, x = e[12], z = e[14];
      if (x < BOX[0] || x > BOX[1] || z < BOX[2] || z > BOX[3]) return;
      const m = o.material; if (!m || Array.isArray(m) || !m.color) return;
      const key = m.blending === 2 ? 'additive'
        : (m.alphaTest > 0 ? 'alphaCut' : (m.transparent ? 'translucent' : 'opaque'));
      const v = (m.color.r + m.color.g + m.color.b) / 3;
      if (!out[key]) out[key] = { n: 0, sum: 0 };
      out[key].n++; out[key].sum += v;
    });
    for (const k in out) out[k] = +(out[k].sum / out[k].n).toFixed(3);
    return out;
  }, [BOX]);
};
console.log('13:00 ', JSON.stringify(await probe(13)));
console.log('23:00 ', JSON.stringify(await probe(23)));
await b.close();
