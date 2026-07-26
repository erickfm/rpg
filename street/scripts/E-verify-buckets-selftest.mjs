// E-verify sorts every area into passed / failed / inconclusive / misused.
// This proves the sorting is right, by running it against children whose exit
// codes and output are known.
//
// WHY IT EXISTS. The rule it tests was added because the runner had been
// calling two different things "FAILED":
//
//   · a check that exits 3 — "I never got a measurement" (GOTCHAS 32). On a
//     loaded machine this world renders wholly black frames, and `soffit`
//     detected that and said so; the runner reported a broken soffit.
//   · a child that CRASHES — a browser killed under load exits 1 with a stack
//     trace and no verdict. `circuit` did this in one sweep and PASSES
//     standalone, having walked all 71 m of the loop.
//
// Both send someone hunting a fault that is not there, which is the expensive
// direction. But the fix must not defang the runner either — a real FAIL has
// to stay a FAIL — so all three cases are asserted, not just the new two.
//
//   node scripts/E-verify-buckets-selftest.mjs
//
// Exits 2 if any case is sorted wrongly. The fakes are written to the system
// temp dir, so this leaves nothing behind in scripts/.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// THE CLASSIFIER, kept identical to E-verify's. Duplicated deliberately and
// said out loud: a selftest that imports the thing it tests cannot catch the
// thing being deleted. If these two ever disagree, this file is the one that
// is wrong — fix it to match, do not "fix" the runner to match it.
const classify = ({ code, out }) => {
  const saidFail = /^\s*FAIL/m.test(out);
  if (code === 3) return 'inconclusive';
  if (code !== 0 && code !== 2 && !saidFail) return 'inconclusive';
  if (code === 2) return 'misused';
  if (code !== 0) return 'failed';
  return 'passed';
};

const dir = mkdtempSync(join(tmpdir(), 'E-verify-buckets-'));
const CASES = [
  ['refuses',   `console.log('EXIT 3: the world would not draw'); process.exit(3);`,          'inconclusive'],
  ['crashes',   `throw new Error('the browser died under load');`,                            'inconclusive'],
  ['realfail',  `console.log('FAIL  a real fault  measured 1.2 against 0.5'); process.exit(1);`, 'failed'],
  ['badflag',   `console.error('unknown mode'); process.exit(2);`,                            'misused'],
  ['passes',    `console.log('PASS  everything holds'); process.exit(0);`,                    'passed'],
  // the nasty one: a check that fails FOR REAL but also happens to be noisy.
  // It must stay 'failed' — the output test only rescues children that never
  // reported a fault at all.
  ['failsloud', `console.log('some chatter');\nconsole.log('FAIL  still a real fault');\nprocess.exit(1);`, 'failed'],
];

const exec = (script) => new Promise((res) => {
  const p = spawn('node', [script]);
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { out += d; });
  p.on('close', (code) => res({ code, out }));
});

let bad = 0;
for (const [name, body, want] of CASES) {
  const f = join(dir, `${name}.mjs`);
  writeFileSync(f, body);
  const got = classify(await exec(f));
  if (got !== want) { bad++; console.log(`FAIL  ${name.padEnd(10)} wanted ${want}, got ${got}`); }
  else console.log(`PASS  ${name.padEnd(10)} -> ${got}`);
}
rmSync(dir, { recursive: true, force: true });

console.log(bad
  ? `\n${bad} of ${CASES.length} sorted wrongly — E-verify's buckets are BROKEN`
  : `\nall ${CASES.length} sorted correctly: a refusal and a crash are not faults, and a real fault still is`);
process.exit(bad ? 2 : 0);
