// CAN ANY CHECK IN THE REGISTRY REPORT FAILED AND STILL EXIT 0?
//
// Item 39's second half. `scripts/checks.mjs` reads a check's verdict from
// `spawnSync(...).status` and nothing else — no shell, no pipeline — so a
// check that prints FAIL and returns 0 is a green row on a red world, and the
// runner cannot possibly tell. `checks.mjs` already records two ways that has
// happened (a mode word that matches no branch and falls off the end; scripts
// that "asserted without an exit code"), so this is not hypothetical.
//
// STATIC, and it says so: it reads each registered script and asks whether a
// FAIL-printing path can reach the end of the file. That is a hypothesis about
// the source, not a measurement of a run — every name it prints has to be read
// before it is believed. It is here because the alternative, making 90-odd
// checks genuinely fail one at a time, is days of work.
//
// Three verdicts:
//   EXITS ON ITS COUNT  a `process.exit(<expr>)` or `process.exitCode` whose
//                       value is not the literal 0. Fine.
//   NEVER PRINTS FAIL   nothing in it prints FAIL/FAILED/not ok. Nothing to lose.
//   *** CAN PRINT FAIL AND EXIT 0 ***  everything else. Read it.
//
//   node scripts/probes/can-a-check-print-fail-and-exit-0.mjs
import { readFileSync, existsSync } from 'node:fs';

const src = readFileSync('scripts/checks.mjs', 'utf8');

// The registry is `const CHECKS = [ ['name', 'question', …], … ]`. Pull the
// first string of every row rather than trying to parse the array — the rows
// carry booleans, arrays and comments and only the name matters here.
const start = src.indexOf('const CHECKS');
if (start < 0) { console.error('could not find CHECKS in scripts/checks.mjs'); process.exit(2); }
const region = src.slice(start, src.indexOf('\n];', start));
const names = [...region.matchAll(/^\s*\['([\w.-]+)',/gm)].map((m) => m[1]);
console.log(`${names.length} checks registered in scripts/checks.mjs\n`);

const prints = /FAIL|not ok|✗/;
// a non-zero or computed exit: process.exit(anything but a literal 0), or any
// assignment to process.exitCode
const realExit = /process\.exit\(\s*(?!0\s*\))|process\.exitCode\s*=/;

const rows = [];
for (const n of names) {
  const path = `scripts/${n}.mjs`;
  if (!existsSync(path)) { rows.push([n, 'NO SUCH FILE']); continue; }
  const s = readFileSync(path, 'utf8');
  // strip line comments so a `// … exits 0 …` note is not read as code
  const code = s.replace(/^\s*\/\/.*$/gm, '');
  const canRed = realExit.test(code);
  // "never prints FAIL" is only harmless if it can still go red some other way.
  // A script that neither prints a failure NOR ever exits non-zero is a check
  // that cannot fail, which this project has already paid for twice — worse
  // than one that is wrong, because nobody re-reads a permanently green row.
  if (!prints.test(code)) {
    rows.push([n, canRed ? 'no FAIL text, but exits non-zero' : 'CANNOT GO RED AT ALL']);
    continue;
  }
  rows.push([n, canRed ? 'exits on its count' : 'CAN PRINT FAIL AND EXIT 0']);
}

const BAD = ['CAN PRINT FAIL AND EXIT 0', 'CANNOT GO RED AT ALL', 'NO SUCH FILE'];
const bad = rows.filter((r) => BAD.includes(r[1]));
for (const [n, v] of rows.filter((r) => v_is_note(r[1]))) console.log(`  ${n.padEnd(28)} ${v}`);
function v_is_note(v) { return v === 'no FAIL text, but exits non-zero'; }
console.log('');
for (const [n, v] of bad) console.log(`  *** ${n.padEnd(24)} ${v}`);
console.log(`\n${rows.length - bad.length} of ${rows.length} can go red on their own verdict.`);
console.log(bad.length
  ? `${bad.length} to READ — static, so each is a candidate and not yet a finding.`
  : 'None can report FAILED while exiting 0, and none is permanently green.');
process.exit(0);
