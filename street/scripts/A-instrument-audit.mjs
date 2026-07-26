// HOW BIG IS THE PROBLEM OF INSTRUMENTS YOU CANNOT TRUST ABOUT THEIR OWN SCOPE?
//
// Three faults this session, all the same family — a check that is wrong about
// what it measured rather than wrong about the world:
//
//   reach.mjs        seeded its flood fill outside its own grid and called the
//                    whole world unwalkable AT EXIT 0
//   footpaint.mjs    hardcoded a port, so only its author could aim it
//   floaters-walk    took a room name and ignored it, printing the HOTEL's rows
//                    for `floaters-walk.mjs diner`
//
// The desk asked for the size of it rather than meeting them one blocker at a
// time. This is a STATIC read of scripts/ — it greps, it does not run anything,
// so it reports SUSPECTS and not faults. That distinction is the whole honesty
// of the thing: I have filed false findings today by trusting a loose predicate,
// and a static test for "does this script honour its argument" cannot be exact.
// Each category below says what it can and cannot see.
//
//   node scripts/A-instrument-audit.mjs          # counts
//   node scripts/A-instrument-audit.mjs --list   # every file in every category
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = new URL('.', import.meta.url).pathname;
const LIST = process.argv.includes('--list');
const BAD = process.argv.slice(2).filter((a) => a !== '--list');
if (BAD.length) {
  console.error(`\n  CANNOT USE THESE ARGUMENTS: ${BAD.join(' ')}. Nothing was measured.`);
  console.error('  give nothing, or --list\n');
  process.exit(2);
}

const files = readdirSync(DIR).filter((f) => f.endsWith('.mjs') && !f.startsWith('tmp-'));
const cat = { port: [], path: [], arg: [], exit: [], world: [] };

for (const f of files) {
  const src = readFileSync(join(DIR, f), 'utf8');
  const code = src.replace(/^\s*\/\/.*$/gm, '');          // comments are not behaviour

  // 1. PORT. A literal localhost:NNNN with no env or argv override beside it.
  //    Cannot see: a port passed through a helper it imports.
  const hasPort = /localhost:\d{4}/.test(code);
  const aimable = /SHOT_URL|process\.env\.[A-Z_]*URL|process\.argv/.test(code);
  if (hasPort && !aimable) cat.port.push(f);

  // 2. PATH. An absolute path outside the repo, in code rather than a comment.
  if (/['"`]\/(home|Users|tmp)\//.test(code)) cat.path.push(f);

  // 3. ARGUMENT ACCEPTED AND IGNORED — the floaters-walk shape, and the one
  //    this can least afford to overstate. The signature is: it reads argv, and
  //    there is NO path that rejects an argument it cannot use. A script that
  //    can exit 2, or throw, or print a usage line, has somewhere for a bad
  //    argument to go; one with none silently widens the run.
  //    Cannot see: whether the value is genuinely used once parsed.
  const readsArgv = /process\.argv/.test(code);
  const rejects = /exit\(2\)|USAGE|usage:|CANNOT USE|NO SUCH|Number\.isFinite|isNaN/.test(code);
  if (readsArgv && !rejects) cat.arg.push(f);

  // 4. CATASTROPHE AT EXIT 0 — the reach.mjs shape. It opens a browser, so it
  //    is a check rather than a utility, and it has no failing exit at all.
  //    Cannot see: scripts that report by design and are right to (floaters-walk
  //    says so in its own header). This is a list to READ, not a list to fix.
  //    Detect a real IMPORT, not the word: matching /playwright/ made this
  //    script count itself, because the pattern appears in its own source. A
  //    heuristic that catches its own text is a small joke here and would be a
  //    silent overcount in a category anyone acts on.
  const isCheck = /from ['"]playwright['"]|require\(['"]playwright['"]\)/.test(code);
  if (isCheck && !/process\.exit\(1\)/.test(code)) cat.exit.push(f);

  // 5. CANNOT SAY WHICH WORLD IT READ — GOTCHAS 26, and the reason exit 3
  //    exists. Measured before at 122; tracked here so it moves.
  if (isCheck && !/reportWorld/.test(code)) cat.world.push(f);
}

const rows = [
  ['hardcoded port, not aimable',              cat.port, 'only its author can point it at a world'],
  ['absolute path in code',                    cat.path, 'runs on one machine'],
  ['reads argv with no rejection path',        cat.arg,  'an argument it cannot use widens the run silently'],
  ['opens a browser, cannot fail',             cat.exit, 'can report a catastrophe and exit 0'],
  ['opens a browser, cannot say which world',  cat.world, 'GOTCHAS 26'],
];
console.log(`\n${files.length} scripts in scripts/\n`);
for (const [name, list, why] of rows) {
  console.log(`  ${String(list.length).padStart(3)}  ${name.padEnd(38)} ${why}`);
  if (LIST && list.length) for (const f of list) console.log(`         ${f}`);
}
console.log(`\nSUSPECTS, not faults — this greps and runs nothing. Each line needs a`);
console.log(`human read before anyone is routed to it.\n`);
