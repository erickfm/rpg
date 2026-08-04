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

// ── ITEM 305: IT VOTES ON THE INSTRUMENTS, AND REPORTS THE PROBES ──────────
//
// This stood red for days at "45 still fall back to a hardcoded port", and 40
// of the 45 were in `scripts/probes/` — one-shot investigations, each written
// for one question on one afternoon, none of them ever run again. The rule is
// right and the veto was aimed at a graveyard, so it went red every time
// anybody filed a probe: red by construction, which is the shape the user's
// standing rule rules out ("stay away from tests that are failure prone").
//
// The 5 that were NOT probes are fixed in the same commit and this now holds
// them: `scripts/*.mjs` is the set the suite spawns and the set a builder runs
// by hand, and that is exactly where a guessed port costs an item. Probes are
// still counted and still printed — a reader can see the number move — they
// just do not veto. Same shape as w101-shots-enoent's "votes on the REGISTERED
// subset only ... a check that cries wolf is how the four survived".
const isProbe = (f) => f.startsWith('scripts/probes/');
const offenders = [], probeOffenders = [];
for (const f of files) {
  if (EXEMPT.has(f)) continue;
  const src = readFileSync(f, 'utf8');
  for (const [i, line] of src.split('\n').entries()) {
    // A line that is wholly a comment is documentation, not an instrument.
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
    if (!BARE.test(line)) continue;
    (isProbe(f) ? probeOffenders : offenders).push(`${f}:${i + 1}  ${line.trim().slice(0, 90)}`);
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

// A NUMBER IN BOTH HALVES, never an absence (GOTCHAS: "0 found" is what
// measuring nothing produces). The population is stated before either verdict,
// so an empty scan cannot read as a pass.
const instruments = files.filter((f) => !EXEMPT.has(f) && !isProbe(f)).length;
const probes = files.filter((f) => !EXEMPT.has(f) && isProbe(f)).length;
console.log(`${instruments} instrument(s) and ${probes} one-shot probe(s) scanned in scripts/`);
if (instruments < 100) {
  console.log(`\nTHIS CHECK MEASURED ALMOST NOTHING: ${instruments} instruments is not this tree.`);
  console.log('  "0 silent instruments" is free over an empty scan. Fix the walk, not the tree.');
  process.exit(2);
}
if (probeOffenders.length) {
  console.log(`\n${probeOffenders.length} of the ${probes} probes still guess a port — REPORTED, NOT A VERDICT.`);
  console.log('  They honour SHOT_URL when it is set; they just do not announce the guess');
  console.log('  when it is not. Each was written for one question on one afternoon and is');
  console.log('  not run by the suite, so this does not go red on them.');
}
if (offenders.length) {
  console.log(`\n${offenders.length} of the ${instruments} INSTRUMENTS fall back to a hardcoded port in silence:\n`);
  for (const o of offenders) console.log(`  ${o}`);
  console.log(`\n  Route it through the helper, which returns SHOT_URL when it is set and`);
  console.log(`  announces the port loudly when it is not:\n`);
  console.log(`      import { aim } from './lib/aim.mjs';    // '../lib/aim.mjs' in probes/`);
  console.log(`      const URL = aim('http://localhost:4185/');\n`);
  process.exit(1);
}
console.log(`all ${instruments} instruments are either aimed or say which port they guessed`);
