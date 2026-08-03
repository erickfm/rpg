// DID THE WORLD MOVE? The interior fix changes material assignment and texture
// repeat/offset and nothing else, so the claim to prove is that every mesh is
// still the same size in the same place.
//
// `fp`/`fpdiff` is the wrong instrument here even though no geometry is added:
// the fix creates extra texture clones, three draws random UUIDs per texture,
// scenedump seeds Math.random globally, and every dithered texture built after
// the first extra clone repaints. That is BUILDER-BRIEF §10's documented
// false catastrophe. So compare the thing I actually claim is unchanged —
// geometry parameters and world position, as a MULTISET so ordering cannot
// manufacture a difference.
//
//   node scripts/probes/w62-geomdiff.mjs before
//   ...change...
//   node scripts/probes/w62-geomdiff.mjs after
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const TAG = process.argv[2] || 'now';
const URL = aim('http://localhost:4183/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(1500);

const keys = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const out = [];
  s.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry, pr = g.parameters || {};
    const e = o.matrixWorld.elements;
    const n = (v) => (typeof v === 'number' ? v.toFixed(3) : '-');
    out.push([g.type, n(pr.width), n(pr.height), n(pr.depth), n(pr.radius),
              n(e[12]), n(e[13]), n(e[14])].join('|'));
  });
  return out.sort();
});
writeFileSync(`shots/w62-geom-${TAG}.json`, JSON.stringify(keys));
console.log(`${keys.length} meshes recorded -> shots/w62-geom-${TAG}.json`);

if (TAG === 'after' && existsSync('shots/w62-geom-before.json')) {
  const before = JSON.parse(readFileSync('shots/w62-geom-before.json', 'utf8'));
  const count = (a) => { const m = new Map(); for (const k of a) m.set(k, (m.get(k) || 0) + 1); return m; };
  const B = count(before), A = count(keys);
  const gone = [], made = [];
  for (const [k, v] of B) { const d = v - (A.get(k) || 0); if (d > 0) gone.push(`${d}x ${k}`); }
  for (const [k, v] of A) { const d = v - (B.get(k) || 0); if (d > 0) made.push(`${d}x ${k}`); }
  console.log(`\nmeshes before ${before.length}, after ${keys.length}`);
  console.log(`geometry that DISAPPEARED: ${gone.length}`);
  for (const g of gone.slice(0, 10)) console.log('   -', g);
  console.log(`geometry that APPEARED:    ${made.length}`);
  for (const g of made.slice(0, 10)) console.log('   +', g);
  if (!gone.length && !made.length) console.log('\nIDENTICAL — every mesh is the same size in the same place.');
  process.exit(gone.length || made.length ? 1 : 0);
}
await b.close();
