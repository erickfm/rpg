// DID ANYTHING OUTSIDE THE SHRINE MOVE?
//
// `fpdiff` compares the sorted lists POSITIONALLY, so inserting six meshes
// shifts every later entry and the counts it prints ("294 textures differ")
// are mostly alignment, not movement. Worse, the `textures` hash cannot match
// across this change at all: three's generateUUID() draws four Math.random()
// values per object/material/geometry, scenedump seeds Math.random globally to
// make dither() reproducible, and so ADDING ANY MESH shifts the stream and
// repaints every dithered texture built after it. That hash is only a valid
// "the art did not move" check for a refactor that adds and removes nothing.
//
// So compare `places` as a MULTISET instead, and say exactly what appeared,
// what vanished, and where. Usage: node scripts/w44-placediff.mjs before after
import { readFileSync } from 'node:fs';

const [a, b] = process.argv.slice(2);
if (!a || !b) { console.error('usage: w44-placediff.mjs <labelA> <labelB>'); process.exit(2); }
const A = JSON.parse(readFileSync(`shots/${a}.json`, 'utf8'));
const B = JSON.parse(readFileSync(`shots/${b}.json`, 'utf8'));

const bag = (xs) => { const m = new Map(); for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1); return m; };
const diff = (m, n) => {
  const out = [];
  for (const [k, c] of m) { const d = c - (n.get(k) ?? 0); if (d > 0) out.push([k, d]); }
  return out.sort();
};
const pa = bag(A._places), pb = bag(B._places);
const gone = diff(pa, pb), came = diff(pb, pa);

// the shrine's own corner, in WORLD coords: the church slab centre is 760 and
// the votive corner is local x -6.5..-4.9, z 7.6..8.1
const inShrine = (k) => {
  const m = /@(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)$/.exec(k);
  if (!m) return false;
  const [x, y, z] = [+m[1], +m[2], +m[3]];
  return x > 752.9 && x < 755.5 && z > 7.3 && z < 8.4 && y > 1.0 && y < 2.4;
};

const report = (name, xs) => {
  const mine = xs.filter((e) => inShrine(e[0]));
  const other = xs.filter((e) => !inShrine(e[0]));
  console.log(`\n${name}: ${xs.length} distinct (${mine.length} in the shrine corner, ${other.length} elsewhere)`);
  for (const [k, c] of other) console.log(`   ELSEWHERE  ${k}${c > 1 ? ` x${c}` : ''}`);
  for (const [k, c] of mine) console.log(`   shrine     ${k}${c > 1 ? ` x${c}` : ''}`);
};
report('only in ' + a, gone);
report('only in ' + b, came);

const strayGone = gone.filter((e) => !inShrine(e[0])).length;
const strayCame = came.filter((e) => !inShrine(e[0])).length;
console.log(`\nobjects ${A.objects} -> ${B.objects}  (${B.objects - A.objects})`);
console.log(`positions that changed OUTSIDE the shrine corner: ${strayGone} gone / ${strayCame} new`);
console.log(strayGone + strayCame === 0
  ? 'CLEAN — nothing outside the shrine moved.'
  : 'Check these against the drifting-prop noise floor (pigeons, ~4-6, y only).');
