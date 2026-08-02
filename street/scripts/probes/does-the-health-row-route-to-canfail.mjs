// Does checks.mjs's `health` row actually reach canfail, or does it still say
// "no selftest"?
//
// checks.mjs has no way to run one check by name, and the full suite takes
// minutes and is documented to kill the preview server (LEDGER: "the full check
// suite kills the preview server, and ~half its 52 failures are artefacts"). So
// this reads the registry it edits and replays the runner's OWN branch logic
// against that row, rather than asserting the edit looks right by eye.
//
// The two lines being replayed, verbatim from scripts/checks.mjs:
//     if (SELFTEST && !selftest) { rows.push([name, 'no selftest', '—']); continue; }
//     if (SELFTEST && typeof selftest !== 'boolean') { ...spawn canfail... }
//
// `health` carried `false` for months, which took the FIRST branch — so the one
// check in the suite that could not go red was also the one with no mutation
// behind it, and `npm run checks -- --selftest` printed `no selftest` and moved
// on. This fails if it ever goes back.
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../checks.mjs', import.meta.url), 'utf8');
const m = src.match(/const CHECKS = \[([\s\S]*?)\n\];/);
if (!m) { console.log('FAIL — could not find the CHECKS array in scripts/checks.mjs'); process.exit(1); }
const CHECKS = Function(`return [${m[1]}\n]`)();

const row = CHECKS.find((c) => c[0] === 'health');
if (!row) { console.log('FAIL — no `health` row in the CHECKS registry'); process.exit(1); }
const selftest = row[2];

let bad = 0;
const say = (okay, line) => { console.log(`${okay ? 'ok  ' : 'FAIL'} ${line}`); if (!okay) bad++; };

say(!!selftest, `health's selftest column is truthy (is ${JSON.stringify(selftest)}) — a falsy one prints "no selftest" and runs nothing`);
say(typeof selftest !== 'boolean', `it is a case-name list, so the runner spawns canfail.mjs rather than passing --selftest to health.mjs`);

const cases = Array.isArray(selftest) ? selftest : [selftest];
// A name that does not exist in canfail is worse than no name: the runner would
// spawn canfail, canfail would filter to nothing, run 0 cases and exit 0, and
// the row would score `ok` having proved nothing at all.
const canfail = readFileSync(new URL('../canfail.mjs', import.meta.url), 'utf8');
for (const c of cases) {
  say(canfail.includes(`['${c}',`), `case '${c}' exists in scripts/canfail.mjs`);
}

console.log(`\n${bad ? `${bad} FAILED` : 'the health row routes to a real mutation'}`);
process.exit(bad ? 1 : 0);
