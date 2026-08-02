// CAN ANY INSTRUMENT STILL MEASURE A DEFAULT PORT WITHOUT SAYING SO?
//
// The sweep that introduced `scripts/lib/aim.mjs` routed 648 scripts off their
// hardcoded defaults. This is what stops the 649th being written — because it
// WILL be: `process.env.SHOT_URL ?? 'http://localhost:4185/'` is the obvious
// line to type, it is in every neighbouring file's history, and it fails
// silently by design. Nothing about a wrong-port run looks wrong.
//
// The cost of not having this is on the record. `canfail.mjs`'s own header
// spends thirty lines on two rounds lost to measuring another builder's world,
// GOTCHAS 48 is the same lesson, and a 5.260 m jump reading cost a builder a
// whole item to disprove. Every one of those was an instrument that guessed a
// port and did not mention it.
//
// Costs no browser and no build — it reads the directory.
//
//   node scripts/aimed.mjs
//   node scripts/aimed.mjs --selftest
//
// Exit 0 every instrument announces or is aimed · 1 at least one is silent.
import { readdirSync, readFileSync, statSync } from 'node:fs';

const SELFTEST = process.argv.includes('--selftest');

// The bare form: SHOT_URL falling back to a literal URL, with no aim() around
// it. Both operators, any spacing — all four variants were present in the tree.
const BARE = /process\.env\.SHOT_URL\s*(?:\?\?|\|\|)\s*['"`]https?:/;

const files = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = `${d}/${e}`;
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (/\.(mjs|js)$/.test(e)) files.push(p);
  }
})('scripts');

// THE HELPER ITSELF QUOTES THE PATTERN, in the comment explaining what it
// replaced, and so does this file. Excluded by NAME rather than by trying to
// tell code from comment with a regex — a detector that strips comments is a
// second parser, and it would be the thing most likely to break here.
const EXEMPT = new Set(['scripts/lib/aim.mjs', 'scripts/aimed.mjs',
  'scripts/probes/w19-aim-codemod.mjs']);

const offenders = [];
for (const f of files) {
  if (EXEMPT.has(f)) continue;
  const src = readFileSync(f, 'utf8');
  for (const [i, line] of src.split('\n').entries()) {
    // A line that is wholly a comment is documentation, not an instrument.
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
    if (BARE.test(line)) offenders.push(`${f}:${i + 1}  ${line.trim().slice(0, 90)}`);
  }
}

// SELFTEST: the detector must actually detect. A guard that cannot fire is
// worse than one that is wrong (BUILDER-BRIEF §7), and this one's whole body is
// a regex — the single most likely thing in it to silently stop matching.
if (SELFTEST) {
  const planted = [
    `const URL = process.env.SHOT_URL ?? 'http://localhost:4185/';`,
    `const URL = process.env.SHOT_URL||'http://localhost:4177/';`,
    `await p.goto(process.env.SHOT_URL ?? "http://localhost:4190/");`,
    `const U = process.env.SHOT_URL   ||   'https://example/';`,
  ];
  const missed = planted.filter((l) => !BARE.test(l));
  const falsePos = [
    `const URL = aim('http://localhost:4185/');`,
    `const URL = process.env.SHOT_URL;`,
    `if (!process.env.SHOT_URL) process.exit(2);`,
  ].filter((l) => BARE.test(l));
  for (const l of planted) console.log(`  ${BARE.test(l) ? 'caught ' : 'MISSED '} ${l}`);
  for (const l of falsePos) console.log(`  FALSE POSITIVE  ${l}`);
  console.log(`\n${planted.length - missed.length}/${planted.length} planted defaults caught,`
    + ` ${falsePos.length} false positives`);
  if (missed.length || falsePos.length) {
    console.log('\nthe detector has stopped detecting — fix BARE before trusting a green run');
    process.exit(1);
  }
  console.log('the detector fires on every shape of the bug and on none of the fixes');
  process.exit(0);
}

console.log(`${files.length} instrument(s) scanned in scripts/`);
if (offenders.length) {
  console.log(`\n${offenders.length} still fall back to a hardcoded port in silence:\n`);
  for (const o of offenders) console.log(`  ${o}`);
  console.log(`\n  Route it through the helper, which returns SHOT_URL when it is set and`);
  console.log(`  announces the port loudly when it is not:\n`);
  console.log(`      import { aim } from './lib/aim.mjs';    // '../lib/aim.mjs' in probes/`);
  console.log(`      const URL = aim('http://localhost:4185/');\n`);
  process.exit(1);
}
console.log('every instrument is either aimed or says which port it guessed');
