// Compare two scene fingerprints as multisets, so we learn WHICH elements
// are unstable rather than just that some hash moved.
// Usage: node scripts/fpdiff.mjs shots/fp-base-a.json shots/fp-base-b.json
import { readFileSync } from 'node:fs';

const [A, B] = process.argv.slice(2).map((p) => JSON.parse(readFileSync(p, 'utf8')));
const cmp = (key) => {
  const a = A['_' + key], b = B['_' + key];
  const cnt = (xs) => { const m = new Map(); for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1); return m; };
  const ma = cnt(a), mb = cnt(b);
  const onlyA = [], onlyB = [];
  for (const [k, n] of ma) { const d = n - (mb.get(k) ?? 0); for (let i = 0; i < d; i++) onlyA.push(k); }
  for (const [k, n] of mb) { const d = n - (ma.get(k) ?? 0); for (let i = 0; i < d; i++) onlyB.push(k); }
  return { key, a: a.length, b: b.length, onlyA, onlyB };
};
let worst = 0;
for (const key of ['textures', 'structure', 'places']) {
  const r = cmp(key);
  worst = Math.max(worst, r.onlyA.length);
  const tag = r.onlyA.length === 0 && r.onlyB.length === 0 ? 'IDENTICAL' : `${r.onlyA.length} differ`;
  console.log(`\n${key.padEnd(10)} ${r.a} vs ${r.b} — ${tag}`);
  for (let i = 0; i < Math.min(6, r.onlyA.length); i++) {
    console.log(`   A: ${String(r.onlyA[i]).slice(0, 150)}`);
    if (r.onlyB[i]) console.log(`   B: ${String(r.onlyB[i]).slice(0, 150)}`);
  }
  if (r.onlyA.length > 6) console.log(`   … and ${r.onlyA.length - 6} more`);
}
process.exitCode = 0;
