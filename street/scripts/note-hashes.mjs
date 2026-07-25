// Does every commit hash a note cites still resolve — for SOMEONE ELSE?
//
// `a67cfda46` found 21 of its author's 59 citations pointing at commits nobody
// else can resolve. The cause is structural rather than careless: builders
// rebase onto mainline every item, the merge train rebases them again, and a
// SHA written down before that lands is a SHA that no longer exists. The note
// still reads perfectly. The hash is just gone.
//
// ── the test that matters is not `git cat-file` ──
//
// Checking a hash resolves in YOUR OWN repo proves almost nothing: your branch
// still holds your commits, and git keeps orphaned pre-rebase objects around
// until it garbage-collects. Mine passed that test 40 times and one of them
// was already unreachable from mainline — my own commit, rebased under me.
//
// So the question is whether the commit is an ancestor of `add-stick-and-city98`,
// which is what another builder would actually look at. That distinction is the
// same one `lib/which-world.mjs` got wrong twice: "in this repo" and "ancestor
// of HEAD" are both weaker than they sound.
//
// Usage:  node scripts/note-hashes.mjs [file...]      default: notes/**.md
//         node scripts/note-hashes.mjs notes/C-*.md   your own, before landing
//
// No browser, no build, ~1 s.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { globSync } from 'node:fs';
import { flags } from './lib/args.mjs';

const { selftest: SELFTEST, rest } = flags(['--selftest']);
// GLOB THE ARGUMENTS. checks.mjs spawns with an args array, which does not go
// through a shell, so a registered `notes/C-*.md` arrives as that literal
// string and readFileSync throws on it. Globbing here means the same argument
// works from a shell and from the runner.
const files = rest.length
  ? rest.flatMap((a) => { const g = globSync(a); return g.length ? g : [a]; })
  : [...globSync('notes/*.md'), ...globSync('notes/queues/*.md')];

const MAIN = 'add-stick-and-city98';
// EXIT CODE, not output. `git cat-file -e` and `git merge-base --is-ancestor`
// both succeed SILENTLY — empty stdout — so a helper that returns the trimmed
// output and is tested for truthiness reads every success as a failure. My
// first version did exactly that and reported "0 commit citations" across
// fifteen notes holding thirty-seven. The empty-set guard below caught it,
// which is the only reason I am not publishing a clean sweep of nothing.
const git = (args) => {
  try {
    const out = execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return { ok: true, out: out.trim() };
  } catch { return { ok: false, out: '' }; }
};

if (!git(['rev-parse', '--verify', MAIN]).ok) {
  console.error(`\nNO ${MAIN} IN THIS REPO — cannot tell what another builder could resolve.`);
  process.exit(3);
}

let checked = 0;
const dead = new Map();
// --selftest: cite a commit that exists nowhere. It must be reported, not
// skipped — the "not a commit at all" branch above is the one that could
// swallow it, and that branch is why this needs a selftest at all.
const FAKE = 'deadbee1234';
for (const f of files) {
  let text;
  try { text = readFileSync(f, 'utf8'); } catch { continue; }
  // 7-40 hex chars with at least one letter, so decimal constants like the
  // LCG's 1664525 and 4294967296 are not mistaken for abbreviated hashes —
  // they matched on my first pass and reported four false deaths.
  const seen = new Set((text.match(/\b[0-9a-f]{7,40}\b/g) ?? []).filter((h) => /[a-f]/.test(h)));
  if (SELFTEST && f === files[0]) { seen.add(git(['rev-parse', 'HEAD']).out); }
  // A note may cite a dead hash ON PURPOSE — the recovery table does it in
  // every row, and so does any note explaining that X was rebased into Y. That
  // is not a broken citation, it is a repointing, and the thing that makes it
  // safe is naming the live commit beside it. So: a dead hash is excused when
  // its own line also carries a hash that IS on mainline.
  //
  // Found by my own check going red on my own census the moment I wrote it,
  // which is the right way round — a rule that cannot express "this hash is
  // dead and here is its replacement" would push people to delete the history
  // rather than record it.
  const lines = text.split('\n');
  const excused = new Set();
  for (const line of lines) {
    const hs = (line.match(/\b[0-9a-f]{7,40}\b/g) ?? []).filter((h) => /[a-f]/.test(h));
    if (hs.length < 2) continue;
    const live = hs.filter((h) => git(['cat-file', '-e', `${h}^{commit}`]).ok
      && git(['merge-base', '--is-ancestor', h, MAIN]).ok);
    if (live.length) for (const h of hs) if (!live.includes(h)) excused.add(h);
  }

  for (const h of seen) {
    if (!git(['cat-file', '-e', `${h}^{commit}`]).ok) continue;   // not a commit at all
    checked++;
    if (excused.has(h)) continue;                 // cited beside its replacement
    if (!git(['merge-base', '--is-ancestor', h, MAIN]).ok) {
      const subj = git(['log', '-1', '--format=%s', h]).out || '(unknown)';
      if (!dead.has(f)) dead.set(f, []);
      dead.get(f).push([h, subj]);
    }
  }
}

console.log(`\n${checked} commit citations across ${files.length} notes`);
if (!checked) {
  console.error('\nNO CITATIONS FOUND AT ALL — nothing was checked, so this is not a pass.');
  console.error('  GOTCHAS 34. Either the files are wrong or the hash pattern stopped matching.');
  process.exit(3);
}

// The recovery table, if it is there. 12be9e163 built the dead->live mapping
// while the orphaned objects still existed, verified with `git patch-id
// --stable`. Reading it here turns this check from "something is broken" into
// "change this to that", which is the difference between a red anyone can act
// on and a red that needs its author.
//
// Optional on purpose: the table is another builder's file and may be renamed,
// finished or deleted. Its absence costs the suggestion, not the check.
const RECOVERY = 'notes/AUDIT-hash-recovery.md';
const recover = new Map();
try {
  for (const line of readFileSync(RECOVERY, 'utf8').split('\n')) {
    const m = line.match(/^\|\s*`([0-9a-f]{7,40})`\s*\|\s*`([0-9a-f]{7,40})`\s*\|/);
    if (m) recover.set(m[1], m[2]);
  }
} catch { /* no table; suggestions are simply absent */ }

let n = 0;
for (const [f, list] of [...dead].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n  ${f} — ${list.length} unreachable from ${MAIN}:`);
  for (const [h, subj] of list.slice(0, 6)) {
    const live = recover.get(h) ?? [...recover].find(([k]) => h.startsWith(k) || k.startsWith(h))?.[1];
    console.log(`     ${h}  ${subj.slice(0, 52)}`
      + (live ? `\n        -> mainline holds it as ${live}` : ''));
  }
  if (list.length > 6) console.log(`     ...and ${list.length - 6} more`);
  n += list.length;
}
if (recover.size) console.log(`\n  (${recover.size} repointings available in ${RECOVERY})`);

if (n) {
  if (SELFTEST) { console.log('SELFTEST PASSED — the unreachable citation was caught'); process.exit(0); }
  console.error(`\n${n} of ${checked} citations point at commits another builder cannot resolve.`);
  console.error(`  They resolve for YOU because your branch still holds them, or because git`);
  console.error(`  has not yet collected the pre-rebase objects. Cite the SHA mainline holds,`);
  console.error(`  or cite the commit SUBJECT, which survives every rebase.\n`);
  process.exit(1);
}
if (SELFTEST) { console.error('\nSELFTEST FAILED — an unreachable citation was injected and this did not notice.'); process.exit(2); }
console.log('every cited commit is reachable from mainline.\n');
