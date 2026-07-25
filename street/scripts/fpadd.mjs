// Fingerprint diff for a PURELY ADDITIVE change — a new interior, a new prop.
//
// `fpdiff.mjs` compares the two dumps index by index. The lists are sorted, so
// inserting objects shifts everything after the insertion point and the whole
// tail reports as changed: adding the diner made it print "71 textures differ"
// when not one texture had actually changed. That is a useless answer to the
// only question worth asking, which is "did I move anything that was already
// there?"
//
// So compare them as MULTISETS instead and report the two halves separately:
//
//   lost   — was in A and is not in B. For an additive change this must be 0.
//            Anything here is something you removed or altered.
//   gained — is in B and was not in A. Your new work. Expected to be nonzero.
//
// `_places` is filtered to the street (|x| < 100) because interiors live out
// at x ≥ 400 and would otherwise drown the signal. Expect a handful of losses
// there regardless: the pigeons move, and GOTCHAS §1 puts that at the noise
// floor. They pair up — same x, centimetres of drift in y/z.
//
// Usage: node scripts/fpadd.mjs shots/before.json shots/after.json
import { readFileSync } from 'node:fs';

const [A, B] = process.argv.slice(2).map((p) => JSON.parse(readFileSync(p, 'utf8')));
if (!A || !B) { console.error('usage: fpadd.mjs <before.json> <after.json>'); process.exit(2); }

const multiset = (arr) => {
  const m = new Map();
  for (const s of arr) m.set(s, (m.get(s) ?? 0) + 1);
  return m;
};
const streetOnly = (arr) => arr.filter((s) => {
  const m = /@(-?[\d.]+),/.exec(s);
  return m ? Math.abs(+m[1]) < 100 : true;
});

let lostTotal = 0;
for (const key of ['_textures', '_structure', '_places']) {
  const onStreet = key === '_places';
  const a = multiset(onStreet ? streetOnly(A[key]) : A[key]);
  const b = multiset(onStreet ? streetOnly(B[key]) : B[key]);
  const lost = [], gained = [];
  for (const [k, n] of a) { const d = n - (b.get(k) ?? 0); if (d > 0) lost.push([k, d]); }
  for (const [k, n] of b) { const d = n - (a.get(k) ?? 0); if (d > 0) gained.push([k, d]); }
  const nl = lost.reduce((s, x) => s + x[1], 0);
  const ng = gained.reduce((s, x) => s + x[1], 0);
  if (!onStreet) lostTotal += nl;
  console.log(`\n${key.slice(1)}${onStreet ? ' (street only, |x| < 100)' : ''}: `
    + `${nl} lost, ${ng} gained`);
  for (const [k, n] of lost.slice(0, 15)) console.log(`  - ${n}× ${k.slice(0, 140)}`);
  if (lost.length > 15) console.log(`  … ${lost.length - 15} more kinds lost`);
  for (const [k, n] of gained.slice(0, 5)) console.log(`  + ${n}× ${k.slice(0, 140)}`);
  if (gained.length > 5) console.log(`  … ${gained.length - 5} more kinds gained`);
}

console.log(lostTotal === 0
  ? '\nADDITIVE — nothing that existed before was changed or removed.'
  : `\nNOT ADDITIVE — ${lostTotal} texture/structure entries disappeared. Look at them.`);
process.exit(lostTotal === 0 ? 0 : 1);
