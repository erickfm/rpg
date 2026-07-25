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
//   lost   — was in A and is not in B: something you removed or altered.
//   gained — is in B and was not in A: your new work, expected to be nonzero.
//
// Two things stop a raw "lost" count from meaning what it looks like, and both
// are handled below rather than left for the reader:
//
//   · The pigeons and the citizens are alive, so a few street positions differ
//     every run (GOTCHAS §1's noise floor). Lost positions are paired against
//     new ones within 0.3 m and reported as drift, not as movement.
//   · three.js spends four Math.random calls per object on generateUUID, and
//     the harness seeds Math.random — so creating ANY object repaints the
//     grain of every texture made after it. Lost textures are matched by pixel
//     size to tell a repaint from a real deletion.
//
// `_places` is filtered to the street (|x| < 100): interiors live out at
// x ≥ 400 and would otherwise drown the signal.
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

// A texture that "disappeared" is almost never a texture that was DELETED — it
// is the same texture repainted with different grain. three.js burns four
// Math.random calls per object in generateUUID, and the harness seeds
// Math.random, so creating any new object reshuffles the grain of everything
// painted after it. Tell the two apart by pixel SIZE: a repaint loses a
// 64x16 and gains a 64x16, a deletion loses one and gains nothing.
const classifyTextures = () => {
  const sa = new Set(A._textures), sb = new Set(B._textures);
  const size = (s) => s.split(':')[0];
  const lost = {}, gained = {};
  for (const s of A._textures) if (!sb.has(s)) lost[size(s)] = (lost[size(s)] ?? 0) + 1;
  for (const s of B._textures) if (!sa.has(s)) gained[size(s)] = (gained[size(s)] ?? 0) + 1;
  let repaint = 0, deleted = 0;
  for (const [d, n] of Object.entries(lost)) {
    const g = gained[d] ?? 0;
    repaint += Math.min(n, g);
    deleted += Math.max(0, n - g);
  }
  return { repaint, deleted };
};

let lostTotal = 0, streetLost = 0;
for (const key of ['_textures', '_structure', '_places']) {
  const onStreet = key === '_places';
  const a = multiset(onStreet ? streetOnly(A[key]) : A[key]);
  const b = multiset(onStreet ? streetOnly(B[key]) : B[key]);
  const lost = [], gained = [];
  for (const [k, n] of a) { const d = n - (b.get(k) ?? 0); if (d > 0) lost.push([k, d]); }
  for (const [k, n] of b) { const d = n - (a.get(k) ?? 0); if (d > 0) gained.push([k, d]); }
  const nl = lost.reduce((s, x) => s + x[1], 0);
  const ng = gained.reduce((s, x) => s + x[1], 0);
  console.log(`\n${key.slice(1)}${onStreet ? ' (street only, |x| < 100)' : ''}: `
    + `${nl} lost, ${ng} gained`);
  if (!onStreet) { lostTotal += nl; } else {
    // Pair each vanished street position against a nearby new one. The pigeons
    // and the citizens are ALIVE — they are somewhere slightly different every
    // run, and GOTCHAS §1 calls that the noise floor. A lost position with a
    // new one a few centimetres away is one of them having taken a step; a
    // lost position with nothing near it is something you actually moved.
    const xyz = (s) => (s.match(/@(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)/) ?? []).slice(1).map(Number);
    const free = gained.flatMap(([k, n]) => Array(n).fill(k)).map(xyz).filter((v) => v.length === 3);
    let drifted = 0;
    for (const [k, n] of lost) for (let c = 0; c < n; c++) {
      const v = xyz(k);
      if (v.length !== 3) { streetLost++; continue; }
      const j = free.findIndex((g) => Math.hypot(g[0] - v[0], g[1] - v[1], g[2] - v[2]) < 0.3);
      if (j >= 0) { free.splice(j, 1); drifted++; } else streetLost++;
    }
    if (drifted) console.log(`  (${drifted} of the above are a pigeon or a citizen having taken a step)`);
  }
  for (const [k, n] of lost.slice(0, 15)) console.log(`  - ${n}× ${k.slice(0, 140)}`);
  if (lost.length > 15) console.log(`  … ${lost.length - 15} more kinds lost`);
  for (const [k, n] of gained.slice(0, 5)) console.log(`  + ${n}× ${k.slice(0, 140)}`);
  if (gained.length > 5) console.log(`  … ${gained.length - 5} more kinds gained`);
}

// The question this tool exists to answer is "did I move the STREET?" — the
// interiors are built last precisely so that the answer can stay no.
const { repaint, deleted } = classifyTextures();
console.log('');
console.log(streetLost === 0
  ? 'STREET UNMOVED — no street position disappeared.'
  : `STREET MOVED — ${streetLost} street positions disappeared. Look at them.`);
console.log(deleted === 0
  ? `TEXTURES INTACT — ${repaint} repainted (grain reshuffled), 0 deleted outright.`
  : `TEXTURES LOST — ${deleted} deleted outright, ${repaint} merely repainted.`);
process.exit(streetLost === 0 && deleted === 0 ? 0 : 1);
