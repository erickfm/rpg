// Item 57: where does w24's exact "0.45 m" come from, and can it ever happen?
//
// Only ONE +x face on the east walk sits at x 6.70 (the rest are 6.88 / 7.00),
// so a 0.45 standoff needs a citizen at lane 6.0 inside that face's z span.
// Q1: what is that face? Q2: does trapAgainst give 0.45 for a citizen there?
// Q3: do the east walkers ever reach that z at all?
//
// Usage: SHOT_URL=http://localhost:4193/ node scripts/probes/w30-trap57-045.mjs
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4193/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const q = await p.evaluate(async () => {
  const { trapAgainst } = await import('/src/proto/ct/gap.ts');
  const cols = window.__ct.colliders();
  const f = (n) => n.toFixed(3);
  // Q1 — every east-walk +x face a pavement walker could meet
  const faces = cols.filter((c) => c.minX > 6.5 && c.minX < 7.6 && c.maxX - c.minX > 0.2
    && c.minZ < 20 && c.maxZ > -100)
    .map((c) => `minX=${f(c.minX)} z[${f(c.minZ)},${f(c.maxZ)}]`).sort();
  // Q2 — a synthetic citizen at the home lane, inside the 6.70 face's z span
  const at = (x, z) => {
    const box = { minX: x - 0.25, maxX: x + 0.25, minZ: z - 0.25, maxZ: z + 0.25 };
    return trapAgainst(box, cols.concat([box]));
  };
  const probes = [];
  for (const z of [-88, -90, -92, -80, -70, -60, -40, -20, -10]) {
    const g = at(6.0, z);
    probes.push(`lane 6.00 z=${z}: ${g === null ? 'ok' : 'RED gap=' + f(g)}`);
  }
  return { faces, probes };
});
console.log('east-walk +x faces:');
for (const r of q.faces) console.log('  ' + r);
console.log('\nsynthetic citizen at the home lane:');
for (const r of q.probes) console.log('  ' + r);

// Q3 — do the east walkers ever reach z -94…-86?
console.log('\nwatching east walkers 120 s for their z range …');
let lo = 1e9, hi = -1e9, inBand = 0, n = 0;
for (let i = 0; i < 240; i++) {
  const w = await p.evaluate(() => window.__ct.walkers().filter((k) => k.x > 0)
    .map((k) => ({ x: k.x, z: k.z })));
  for (const k of w) {
    lo = Math.min(lo, k.z); hi = Math.max(hi, k.z); n++;
    if (k.z >= -94 && k.z <= -86) inBand++;
  }
  await p.waitForTimeout(500);
}
console.log(`  east walkers z range ${lo.toFixed(2)} … ${hi.toFixed(2)}`
  + `  (${n} observations, ${inBand} inside the 6.70 face's z -94…-86)`);
await b.close();
