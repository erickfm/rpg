// Route my open findings by NAME, now that tex-world.ts publishes __frontages
// (2bdcf1d8). Every one of these has been sitting on a coordinate that I could
// describe but not attribute -- which is the whole reason the bench ad is in
// BLOCKED-AUDIT-seams.md.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(aim('http://localhost:4184/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, aim('http://localhost:4184/'));   // GOTCHAS 26: prove it, do not just name it
await p.waitForTimeout(900);
const out = await p.evaluate(() => {
  const F = globalThis.__frontages;
  if (!F) return { err: 'no __frontages on globalThis' };
  const OPEN = [
    ['the bus bench / [E] sit at the stop', 6.0, -35.0],
    ['PAWN SHOP door',                      6.0, -60.5],
    ['THRIFT door',                        -6.0, -59.4],
    ['c1 masonry candidate, 9.41 px/m',    -6.9,  -9.0],
    ['the 12 mirrored pennants',            7.18,  2.6],
    ['BODEGA door',                         6.0, -95.4],
    ['A-1 TAX door',                        6.0, -20.1],
    ['DINER door',                         -6.0, -46.6],
  ];
  const keys = Object.keys(F[0] || {});
  // the real schema: span is loWorld..hiWorld along `axis`, and facePos is the
  // cross-axis coordinate of the facade -- its sign is the side of the street.
  const hit = (x, z) => F.filter(f => {
    const along = f.axis === 'z' ? z : x;
    const cross = f.axis === 'z' ? x : z;
    const lo = Math.min(f.loWorld, f.hiWorld), hi = Math.max(f.loWorld, f.hiWorld);
    if (along < lo - 0.5 || along > hi + 0.5) return false;
    return Math.abs(cross - f.facePos) < 4.0;   // the walk is within metres of its own facade
  }).map(f => `${f.name} (face ${f.facePos}, door ${f.doorWorld.toFixed(1)}, ${f.frontageM} m)`);
  return { n: F.length, keys, sample: F.slice(0, 3),
    routed: OPEN.map(([label, x, z]) => ({ label, at: [x, z], frontages: hit(x, z) })) };
});
if (out.err) { console.log(out.err); } else {
  console.log(`__frontages: ${out.n} entries, fields: ${out.keys.join(', ')}`);
  console.log(`sample: ${JSON.stringify(out.sample[0])}\n`);
  for (const r of out.routed)
    console.log(`${r.label.padEnd(38)} (${r.at.join(', ')})  ->  ${r.frontages.length ? r.frontages.join(' / ') : '(no frontage covers it)'}`);
}
writeFileSync('shots/route.json', JSON.stringify(out,null,2));
await b.close();
