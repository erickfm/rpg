// Item 57, reproduction: w24 reported "a 0.5 x 0.5 prop at x 5.75…6.25, 0.45 m
// off the corner block's face at x 6.7". No such collider exists in the STATIC
// set. This probe samples the FULL collider list (movers included, exactly as a
// naive red-dump would) and reports every red box that is 0.5 x 0.5 — the size
// ct/crowd.ts:167 gives a CITIZEN (lane +/- 0.25, z +/- 0.25) — together with
// the collider trapAgainst() paired it with.
//
// Usage: SHOT_URL=http://localhost:4193/ node scripts/probes/w30-trap57-repro.mjs
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4193/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const hits = new Map();
let samples = 0;
for (let i = 0; i < 90; i++) {
  const r = await p.evaluate(async () => {
    const { trapAgainst } = await import('/src/proto/ct/gap.ts');
    const cols = window.__ct.colliders();
    const f = (n) => n.toFixed(3);
    const out = [];
    for (const c of cols) {
      const w = c.maxX - c.minX, d = c.maxZ - c.minZ;
      // a citizen's exact footprint, and only on the east walk
      if (Math.abs(w - 0.5) > 1e-6 || Math.abs(d - 0.5) > 1e-6) continue;
      if (c.minX < 0) continue;
      const g = trapAgainst(c, cols);
      if (g === null) continue;
      // which collider is it trapped against? re-run the pairing by hand:
      // the nearest static face on +x within a metre.
      let against = null, best = 1e9;
      for (const o of cols) {
        if (o === c) continue;
        if (o.maxZ <= c.minZ || o.minZ >= c.maxZ) continue;
        const gap = o.minX - c.maxX;
        if (gap >= 0 && gap < best) { best = gap; against = o; }
      }
      out.push(`citizen-sized x[${f(c.minX)},${f(c.maxX)}] z[${f(c.minZ)},${f(c.maxZ)}]`
        + ` RED gap=${f(g)}`
        + (against ? ` | +x neighbour minX=${f(against.minX)} standoff=${f(best)}` : ''));
    }
    // is it a live walker? cross-check against the crowd's own report
    const walkers = window.__ct.walkers ? window.__ct.walkers()
      .filter((k) => k.x > 0).map((k) => `${k.x.toFixed(2)},${k.z.toFixed(2)}`) : [];
    return { out, walkers };
  });
  samples++;
  for (const line of r.out) hits.set(line, (hits.get(line) ?? 0) + 1);
  if (i === 0) console.log('east-side walkers (x,z) at sample 0:', r.walkers.join('  '));
  await p.waitForTimeout(400);
}
console.log(`\n${samples} samples; ${hits.size} distinct citizen-sized RED boxes\n`);
for (const [k, n] of [...hits].sort((a, z) => z[1] - a[1])) console.log(`  x${n}  ${k}`);
await b.close();
