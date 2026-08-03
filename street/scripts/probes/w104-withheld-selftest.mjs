// DOES THE `WITHHELD` CONVENTION ACTUALLY FIRE? Both signs, seven cases.
//
// Item 258 added a WITHHELD register to scripts/checks-can-fail.mjs so that a
// guard somebody DECIDED NOT TO WRITE is visible to a reader instead of living
// in an English comment. The whole point of the item is that an unexamined
// convention rots — `unstick-walk` sat withheld for six days after its reason
// expired — so shipping the convention without watching it go red both ways
// would have reproduced the bug it fixes.
//
// HOW, without touching the live registry. checks-can-fail.mjs reads
// `scripts/checks.mjs` RELATIVE TO CWD. So each case builds a throwaway tree
//
//     <tmp>/scripts/checks.mjs         a 4-row synthetic registry
//     <tmp>/scripts/checks-can-fail.mjs  the real file, WITHHELD/NO_PROOF_YET swapped
//
// and runs node there. Nothing in the worktree is written to, so a case that
// throws cannot leave the real registry mutated — the failure mode canfail.mjs
// needs a byte-copy backup to survive.
//
// POPULATION FLOOR FIRST. Case 0 asserts the synthetic registry parses to the
// 4 rows it declares. A harness whose fixture stopped parsing would score every
// later case green for the wrong reason, and "the guard exited 1" is exactly
// what a broken fixture and a caught mutation look like from outside.
//
// Usage: node scripts/probes/w104-withheld-selftest.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REAL = readFileSync('scripts/checks-can-fail.mjs', 'utf8');

// A synthetic registry in the shape the parser expects. `declares` is the third
// column: `true`, `['case']` or a bare string declare a failing path; `false`
// does not. Two of each, so no case can pass by the fixture being uniform.
const REGISTRY = `const CHECKS = [
  ['alpha',   'a question?',   true,  [], false],
  ['bravo',   'a question?',   ['some-case'], [], false],
  ['charlie', 'a question?',   false, [], false],
  ['delta',   'a question?',   false, [], false],
];
`;

const lit = (o) => JSON.stringify(o, null, 2);

/** Swap the two registers in a copy of the real guard, run it in a scratch
 *  tree, and hand back what it said. */
function run({ withheld = {}, noProofYet = [], exempt = null, registry = REGISTRY }) {
  const dir = mkdtempSync(join(tmpdir(), 'w104-'));
  try {
    mkdirSync(join(dir, 'scripts'));
    writeFileSync(join(dir, 'scripts', 'checks.mjs'), registry);

    let src = REAL;
    // Replace each register wholesale between its `const X = ` and the closing
    // `;` that ends the literal — the literals are the last thing before the
    // `const src = readFileSync` line, so anchor on that rather than on brace
    // counting.
    src = src.replace(/const NO_PROOF_YET = \[[\s\S]*?\n\];/, `const NO_PROOF_YET = ${lit(noProofYet)};`);
    src = src.replace(/const WITHHELD = \{[\s\S]*?\n\};/, `const WITHHELD = ${lit(withheld)};`);
    if (exempt) src = src.replace(/const EXEMPT = \{[\s\S]*?\n\};/, `const EXEMPT = ${lit(exempt)};`);
    if (src === REAL) throw new Error('the register swap matched nothing — this harness is broken, not the guard');
    writeFileSync(join(dir, 'scripts', 'checks-can-fail.mjs'), src);

    let out = '', code = 0;
    try {
      out = execFileSync(process.execPath, ['scripts/checks-can-fail.mjs'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
      code = e.status;
    }
    return { out, code };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// A withheld entry that is complete. `charlie` declares nothing, which is the
// only state a withholding can legitimately describe.
const FULL = {
  charlie: { since: '2026-07-25', why: 'no single find/replace expresses it', expiresWhen: 'canfail applies two edits', where: 'scripts/canfail.mjs' },
};

const CASES = [
  // ── the floor, first ──────────────────────────────────────────────────────
  ['0  fixture parses',
    { withheld: FULL, noProofYet: ['delta'] },
    (r) => r.out.includes('4 registered checks') || `fixture parsed the wrong number of rows:\n${r.out}`],

  // ── PASS side ─────────────────────────────────────────────────────────────
  ['1  a complete withholding is accepted, and PRINTED on a green run',
    { withheld: FULL, noProofYet: ['delta'] },
    (r) => (r.code === 0 && r.out.includes('WITHHELD — guards deliberately not written')
      && /charlie {2}\(withheld 2026-07-25, \d+ days ago/.test(r.out))
      || `expected exit 0 with the block printed, got ${r.code}:\n${r.out}`],

  ['2  WITHHELD suppresses the "no way to go red" complaint, exactly as EXEMPT does',
    { withheld: FULL, noProofYet: ['delta'] },
    (r) => !r.out.includes('charlie\n') || `charlie was still reported undeclared:\n${r.out}`],

  // ── FAIL side. Each breaks ONE thing and must name it. ────────────────────
  ['3  a withheld guard that has SINCE BEEN WRITTEN goes red',
    // `bravo` declares `['some-case']` — the deferral is over.
    { withheld: { bravo: FULL.charlie }, noProofYet: ['charlie', 'delta'] },
    (r) => (r.code === 1 && r.out.includes('A WITHHELD GUARD HAS SINCE BEEN WRITTEN') && r.out.includes('bravo'))
      || `expected the deferral-over complaint, got ${r.code}:\n${r.out}`],

  ['4  a withheld guard that left the registry goes red',
    { withheld: { echo: FULL.charlie }, noProofYet: ['charlie', 'delta'] },
    (r) => (r.code === 1 && r.out.includes('A WITHHELD GUARD HAS SINCE BEEN WRITTEN') && r.out.includes('echo'))
      || `expected the deferral-over complaint for a name off the registry, got ${r.code}:\n${r.out}`],

  ['5  a withholding with no expiry condition goes red — that is the prose comment again',
    { withheld: { charlie: { since: '2026-07-25', why: 'because', where: 'somewhere' } }, noProofYet: ['delta'] },
    (r) => (r.code === 1 && r.out.includes('NO REASON IS THE PROSE COMMENT AGAIN') && r.out.includes('charlie'))
      || `expected the thin-entry complaint, got ${r.code}:\n${r.out}`],

  ['5b a withholding with no `since` goes red — the age is the whole affordance',
    { withheld: { charlie: { why: 'because', expiresWhen: 'never', where: 'somewhere' } }, noProofYet: ['delta'] },
    (r) => (r.code === 1 && r.out.includes('NO REASON IS THE PROSE COMMENT AGAIN'))
      || `expected the thin-entry complaint for a missing date, got ${r.code}:\n${r.out}`],

  ['6  a name on BOTH registers goes red — they are opposite claims',
    { withheld: FULL, noProofYet: ['charlie', 'delta'] },
    (r) => (r.code === 1 && r.out.includes('BOTH WITHHELD AND ON THE DEBT REGISTER') && r.out.includes('charlie'))
      || `expected the double-count complaint, got ${r.code}:\n${r.out}`],

  // ── the ORIGINAL behaviour, unbroken. If adding a register had swallowed
  //    the complaint this file exists for, every case above would still pass.
  ['7  an undeclared row named on NO register still goes red',
    { withheld: {}, noProofYet: [] },
    (r) => (r.code === 1 && r.out.includes('REGISTERED WITH NO WAY TO GO RED')
      && r.out.includes('charlie') && r.out.includes('delta'))
      || `the pre-existing complaint stopped firing, got ${r.code}:\n${r.out}`],

  ['8  a parser that matches nothing still refuses to report a pass (exit 2)',
    { withheld: {}, noProofYet: [], registry: 'const CHECKS = [\n];\n' },
    (r) => r.code === 2 || `expected exit 2 on an empty parse, got ${r.code}:\n${r.out}`],
];

let bad = 0;
for (const [label, cfg, assert] of CASES) {
  let verdict;
  try { verdict = assert(run(cfg)); } catch (e) { verdict = `threw: ${e.message}`; }
  if (verdict === true) console.log(`  ok    ${label}`);
  else { bad++; console.log(`  FAIL  ${label}\n        ${verdict}`); }
}

console.log(bad
  ? `\n${bad}/${CASES.length} WITHHELD cases did not behave as designed`
  : `\nall ${CASES.length} WITHHELD cases fire as designed — ${CASES.filter(([l]) => /^[3-8]/.test(l)).length} of them are the RED side`);
process.exit(bad ? 1 : 0);
