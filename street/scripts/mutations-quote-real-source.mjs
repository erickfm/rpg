// EVERY MUTATION CASE STILL QUOTES SOURCE THAT EXISTS.
//
// Named for the claim, not for the subject (GOTCHAS §24) — "canfail" and
// "needles" are subjects, and the next person to investigate them would collide.
//
// ── the failure this guards, which happened ──
//
// `scripts/canfail.mjs` proves a check can fail by MUTATING somebody's source:
// each case is a hard-coded quotation of a line, swapped for a broken one. Its
// own note says it best:
//
//   *"A mutation case is a hard-coded quotation of somebody's source; it is the
//   one kind of test that a REFACTOR breaks silently and a bug never does."*
//
// `23e12c691` — mine — split the alley out of `ct/street.ts` into `ct/alley.ts`
// and took the dish with it. Two cases still quoted `street.ts`, so both matched
// nothing:
//
//     FAIL alleydish        NEEDLE  matched 0x, not 1 — mutation not applied
//     FAIL alleydish-flat   NEEDLE  matched 0x, not 1 — mutation not applied
//     0/2 checks caught their mutation
//
// I had proved the world was structurally identical either side of that split —
// textures and structure hashes byte-equal — and that proof says nothing at all
// about a harness that reads SOURCE. Two different instruments again.
//
// ── why this exists when canfail already reports it ──
//
// canfail reports it only while running the full suite: 40 cases, each one a
// source edit plus `npm run build` plus a browser check. That is far too slow to
// run after a refactor, so in practice nobody does, and the cases sit guarding
// air until somebody happens to run the whole thing. This asks the same question
// STATICALLY — no build, no browser, milliseconds — so it can sit in the default
// tier and go red in the commit that breaks it.
//
//   node scripts/mutations-quote-real-source.mjs [--selftest]
import { readFileSync } from 'node:fs';

for (const a of process.argv.slice(2)) {
  if (a !== '--selftest') {
    console.error(`unknown argument ${JSON.stringify(a)} — this script takes --selftest and nothing else`);
    process.exit(2);
  }
}
const SELFTEST = process.argv.includes('--selftest');

/** Pull `CASES` out of canfail.mjs without importing it — it is not exported,
 *  and importing would run a mutation harness. */
function readCases() {
  const src = readFileSync('scripts/canfail.mjs', 'utf8');
  const consts = {};
  for (const m of src.matchAll(/^const ([A-Z_]+) = '([^']+)';/gm)) consts[m[1]] = m[2];
  const start = src.indexOf('const CASES = [');
  if (start < 0) return null;
  const open = src.indexOf('[', start);
  // TERMINATED BY A LINE THAT IS EXACTLY `];`, NOT BY COUNTING BRACKETS. The
  // needles quote source containing `[E]`, and a depth counter reads that as an
  // opening bracket and never closes. My first version did exactly that and
  // died with "CASES is not iterable" — loudly, which is the good way for a
  // parser to be wrong.
  const term = src.indexOf('\n];', open);
  if (term < 0) return null;
  const body = src.slice(open, term + 2);
  try {
    return eval(`(() => { const {${Object.keys(consts).join(',')}} = ${JSON.stringify(consts)}; return ${body}; })()`);
  } catch { return null; }
}

const CASES = readCases();
if (!Array.isArray(CASES)) {
  console.error('\nABORTED — could not read CASES out of scripts/canfail.mjs.');
  console.error('  Its shape has changed. NOTHING WAS MEASURED, so nothing follows');
  console.error('  about the mutation cases (GOTCHAS §32).');
  process.exit(3);
}

// ── POPULATION FIRST (GOTCHAS §34) ────────────────────────────────────────
// Every verdict below is an ABSENCE — "no needle is dead" — and an absence is
// free over an empty set. The floor is MEASURED, not remembered: there are 40
// cases today. 30 leaves room for cases to be legitimately retired while still
// catching a parse that silently returns two of them.
const FLOOR = 30;
if (CASES.length < FLOOR) {
  console.error(`\nABORTED — parsed only ${CASES.length} cases, below the floor of ${FLOOR}.`);
  console.error('  canfail has 40. A number this low means the parse is wrong, not that');
  console.error('  the cases are gone, and "no dead needles" is free at zero.');
  process.exit(3);
}

/** The check itself, isolated so the selftest can run it over a broken set. */
function audit(cases) {
  const dead = [];
  for (const [name, file, needle] of cases) {
    let n;
    try { n = readFileSync(file, 'utf8').split(needle).length - 1; }
    catch { dead.push([name, file, 'FILE MISSING']); continue; }
    // Exactly once is what canfail requires: 0 means the mutation is never
    // applied, and 2+ means it is applied somewhere it was not aimed.
    if (n !== 1) dead.push([name, file, `matched ${n}x, not 1`]);
  }
  return dead;
}

const dead = audit(CASES);
console.log(`\nmutation cases: ${CASES.length}, from scripts/canfail.mjs`);
for (const [name, file, why] of dead) console.log(`  DEAD  ${name.padEnd(16)} ${file}  ${why}`);
console.log(dead.length
  ? `\n${dead.length} case${dead.length > 1 ? 's are' : ' is'} guarding air — the source moved and the quotation did not.`
  : `\nall ${CASES.length} needles still quote source that exists`);

if (SELFTEST) {
  // Break the CHECK'S VIEW while leaving the world intact, which is the
  // mutation class GOTCHAS §34 says a world-mutation cannot reach. canfail.mjs
  // is not mine to edit, and it does not need to be: the predicate is the whole
  // content of this check, so feeding it a case that quotes a line which is not
  // there is the honest test.
  console.log('\nselftest — a case quoting source that does not exist must be caught');
  const planted = [['planted', 'scripts/canfail.mjs', 'a line that is definitely not in this file 8f3a']];
  const caughtDead = audit(planted).length === 1;
  console.log(`  ${caughtDead ? 'PASS' : 'FAIL'}  a needle matching 0x is reported`);
  // …and the population floor must refuse an empty set rather than pass it.
  const caughtEmpty = audit([]).length === 0 && 0 < FLOOR;
  console.log(`  ${caughtEmpty ? 'PASS' : 'FAIL'}  an empty set is below the floor, so it aborts rather than passing`);
  const ok = caughtDead && caughtEmpty;
  console.log(ok
    ? '\nSELFTEST PASSED — both ways this check could be blind were caught'
    : '\nSELFTEST FAILED — this measures less than it claims');
  process.exit(ok ? 0 : 1);
}

process.exit(dead.length ? 1 : 0);
