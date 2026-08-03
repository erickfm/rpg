// DID ANY GEOMETRY CHANGE, OR ONLY MATERIALS?
//
// `fp`'s `places` hash is useless for this change and so is `textures`, for the
// reason BUILDER-BRIEF §10 gives: scenedump seeds Math.random globally, and
// three's generateUUID() draws from it once per object/geometry/material. This
// change adds ~148 texture CLONES, so every draw after the first one shifts —
// and the world's actors (pigeons, citizens, cars) take their positions from
// that same stream. `places` therefore differs even though nothing was moved by
// hand, which is a fact about the instrument, not about the street.
//
// So assert the two things that CANNOT move under a stream shift:
//
//   1. the multiset of geometry signatures. `geomSig` is
//      `Type(param=value,...)#vertexCount` — no material, no position, no
//      random. If a box changed size, or a mesh appeared or vanished, it
//      shows up here and nowhere else.
//   2. the positions of the STATIC civic flights specifically. The steps are
//      authored from constants, so their coordinates are deterministic
//      whatever the random stream does.
//
// Usage: node scripts/probes/w102-geomdiff.mjs before after
import { readFileSync } from 'node:fs';

const [a, b] = process.argv.slice(2);
if (!a || !b) { console.error('usage: w102-geomdiff.mjs <labelA> <labelB>'); process.exit(2); }
const A = JSON.parse(readFileSync(`shots/${a}.json`, 'utf8'));
const B = JSON.parse(readFileSync(`shots/${b}.json`, 'utf8'));

const bag = (xs) => { const m = new Map(); for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1); return m; };
const diff = (m, n) => {
  const out = [];
  for (const [k, c] of m) { const d = c - (n.get(k) ?? 0); if (d > 0) out.push([k, d]); }
  return out.sort();
};

// ── 1. GEOMETRY ─────────────────────────────────────────────────────────────
// `_structure` entries are `type|geomSig|matSig`; drop the material field.
const geom = (S) => S.map((s) => { const p = s.split('|'); return `${p[0]}|${p[1]}`; });
const ga = bag(geom(A._structure)), gb = bag(geom(B._structure));
const gGone = diff(ga, gb), gCame = diff(gb, ga);

console.log('GEOMETRY (type + geometry signature, material dropped)');
console.log(`   ${A._structure.length} objects before, ${B._structure.length} after`);
if (!gGone.length && !gCame.length) {
  console.log('   IDENTICAL as a multiset — no mesh added, removed or resized.\n');
} else {
  for (const [k, n] of gGone) console.log(`   VANISHED x${n}  ${k}`);
  for (const [k, n] of gCame) console.log(`   APPEARED x${n}  ${k}`);
  console.log('');
}

// ── 2. NAME EVERY POSITION THAT MOVED ───────────────────────────────────────
//
// A region filter was the first thing tried here and it was WRONG, in the way
// GOTCHAS 48 and the brief both warn about: scenedump records `o.position`,
// which is LOCAL, while texdensity's `at` column and getWorldPosition report
// WORLD. The civic block sits in a rotated, translated group, so a world-frame
// box around the church flight selected one stray object and the probe's own
// population floor failed it. Rather than convert frames and hope, the check
// below needs no coordinates at all: there are 8612 objects and only a handful
// of entries differ, so PRINT THEM ALL and let the reader see what they are.
//
// The flight steps are identifiable without a region: their boxes are the
// distinctive sizes the treads actually have, listed by
// w102-where-are-the-flights.mjs — 3.60/3.24/2.88/2.52/2.16 x H x 4.10 for the
// library and 4.60 x H x 1.52/1.18/0.84 for the church.
const pa = bag(A._places), pb = bag(B._places);
const gone = diff(pa, pb), came = diff(pb, pa);
const nMoved = gone.reduce((s, e) => s + e[1], 0);

console.log('POSITIONS THAT DIFFER (every one, not a sample)');
console.log(`   ${nMoved} of ${A._places.length} position entries`);
for (const [k, n] of gone) console.log(`   was  x${n}  ${k}`);
for (const [k, n] of came) console.log(`   now  x${n}  ${k}`);

console.log(`\n   unique textures ${A.uniqueTextures} -> ${B.uniqueTextures}`
  + `  (+${B.uniqueTextures - A.uniqueTextures} clones — the stream shift's cause)`);

// A SANITY FLOOR, so this cannot pass by comparing two empty lists.
if (A._places.length < 5000 || B._places.length < 5000) {
  console.log('\nFAIL — a dump with under 5000 objects is not this world.');
  process.exit(1);
}

const ok = !gGone.length && !gCame.length;
console.log(ok
  ? '\nGEOMETRY PASS — no mesh added, removed or resized; only materials changed.'
  + '\nRead the moved list above and confirm it is actors before calling it clean.'
  : '\nFAIL — something structural changed; do not call this a texture-only change.');
process.exit(ok ? 0 : 1);
