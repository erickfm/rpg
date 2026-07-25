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
  // CLASSIFY, do not leave it to the reader.
  //
  // CLAUDE.md says textures and structure must match to prove a change did not
  // move the world. Measured, structure does NOT match run to run: six dumps of
  // identical code gave 9ad3c4ce, 9ad3c4ce, c0a3f42e, 9ad3c4ce, c0a3f42e,
  // c0a3f42e. The cause is three of the car lot's 196 festoon bulbs, which
  // animate between a lit and an unlit colour, so their colour depends on the
  // instant the dump was taken. Pinning the world clock does not stop it —
  // the twinkle runs on its own frame accumulator.
  //
  // A bare "3 differ" invites two wrong readings: that you broke something, or
  // — worse, once people learn it always says that — that a real difference is
  // just noise. So say WHICH kind of difference it is, derived from the pairs
  // themselves rather than from a list of things this file was told to ignore.
  if (r.onlyA.length) {
    const geom = (x) => String(x).split('|').slice(0, 2).join('|');
    const paired = r.onlyA.length === r.onlyB.length;
    if (key === 'structure' && paired) {
      const ga = r.onlyA.map(geom).sort(), gb = r.onlyB.map(geom).sort();
      if (ga.join() === gb.join())
        console.log('   → same geometry, material colour only: ANIMATED COLOUR, not a structural change');
      else console.log('   → geometry itself differs: this IS a structural change');
    }
    if (key === 'places' && paired) {
      const pos = (x) => String(x).split('@')[1]?.split(',').map(Number) ?? [];
      const far = r.onlyA.filter((a) => {
        const pa = pos(a);
        return !r.onlyB.some((b) => { const pb = pos(b);
          return pb.length === 3 && Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]) < 0.05; });
      });
      console.log(far.length
        ? `   → ${far.length} moved further than 5 cm: NOT drift, something was placed differently`
        : '   → every one has a partner within 5 cm: DRIFT (walkers, pigeons), not a move');
    }
  }
}
process.exitCode = 0;
