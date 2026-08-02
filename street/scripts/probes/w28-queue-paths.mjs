#!/usr/bin/env node
// One question: what is the FALSE-POSITIVE rate of claim.sh's new file-existence
// check across every row the live queue has ever held?
//
// A warning that fires on rows that are perfectly fine is a warning nobody
// reads, and this project has a documented family of guards that "slept" for
// exactly that reason. So before shipping the check, run its resolver over every
// `file(s)` column in the queue — DONE rows included, because those are the rows
// we KNOW a builder completed, so any MISSING against one of them is the check
// being wrong rather than the row.
//
//   node scripts/probes/w28-queue-paths.mjs [path/to/QUEUE.md]
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const STREET = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const q = process.argv[2] ?? execFileSync('git', ['rev-parse', '--git-common-dir'],
  { cwd: STREET, encoding: 'utf8' }).trim().replace(/\/?\.git$/, '') + '/street/notes/QUEUE.md';

const rows = readFileSync(q, 'utf8').split('\n')
  .filter((l) => /^\|\s*[0-9]+[a-z]*\s*\|/.test(l))
  .map((l) => { const c = l.split('|'); return { id: c[1].trim(), state: c[2].trim().split(' ')[0], files: c[3] ?? '' }; });

let warned = 0;
for (const r of rows) {
  const out = execFileSync('sh', [`${STREET}/scripts/claim.sh`, '--check-paths', r.files],
    { cwd: STREET, encoding: 'utf8' });
  const bad = /MISSING/.test(out);
  if (bad) warned++;
  console.log(`${bad ? 'WARN' : 'ok  '} ${r.id.padEnd(4)} ${r.state.padEnd(6)} ${r.files.trim().slice(0, 60)}`);
  if (bad) console.log(out.split('\n').filter((l) => /MISSING|at:|^ {14}\S/.test(l)).join('\n'));
}
console.log(`\n${rows.length} rows, ${warned} warned, ${rows.length - warned} silent.`);
