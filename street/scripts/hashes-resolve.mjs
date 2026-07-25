// Every commit hash cited in this repo resolves for SOMEBODY ELSE.
//
// Named for what it asserts (GOTCHAS 24). Costs no browser and no world — it is
// git and a grep, about a second.
//
// ── the defect ──
//
// This project's notes and comments argue by citation: "the argument bf8203196
// made", "reverted per 726faa6b", "bfd0b7ae's question". That is the right habit
// and it is why the reasoning survives context loss. But a hash written down
// while the commit is still on a builder's branch names an object that will not
// exist once it lands, because every builder rebases before merging and a rebase
// REWRITES the commit. The note keeps the old hash; the world keeps the new one.
//
// It resolves fine in the worktree that wrote it — the old object is still in
// the local store — so the author cannot see the problem by checking. Anyone
// with a fresh clone gets `unknown revision`. Another builder found 21 of their
// 59 citations in that state (a67cfda46).
//
// ── why this particular assertion, and not the obvious one ──
//
// The obvious check is "every hash-shaped token resolves", and it is the wrong
// one. e35219f43 qualified their own audit after f51f2a52e showed two hits were
// FINGERPRINTS rather than commits: `npm run fpdiff` prints
// `textures=951d46e3 structure=ba64acce`, which is hash-shaped, is quoted in
// notes, and was never a commit. A DEAD verdict on one of those is a false
// alarm, and widening or narrowing the regex does not fix it, because the two
// are genuinely indistinguishable as strings.
//
// So assert the direction that has no ambiguity:
//
//     a token that RESOLVES AS A COMMIT must be reachable from mainline
//
// A fingerprint never resolves as a commit, so it can never trip this. A hash
// that never existed anywhere does not resolve either, and is somebody's typo
// rather than this check's business. What is left is exactly the defect: a real
// commit, cited, that only exists in the citing author's object store.
//
// ── where this is blind, which is worth knowing before you trust a green ──
//
// It can only flag a citation whose object still exists in THIS store. That
// means it is strongest in the worktree that wrote the note and blind in a
// fresh clone — the exact place the damage shows up. On a fresh clone every
// dead citation fails `cat-file`, gets skipped as "not a commit", and this
// prints OK over a repo full of broken references.
//
// So a green from this check means "nothing I can still see is stranded", not
// "every citation resolves for everyone". GOTCHAS 36 is blunter about the
// underlying trap than I was: two builders separately published "every citation
// resolves" from `git cat-file -e`, which happily resolves orphaned objects
// that exist only locally. The verdict here is `merge-base --is-ancestor` for
// exactly that reason; `cat-file` appears only to tell a commit from a
// fingerprint, never to decide whether a citation is sound.
//
// It is also racing a deletion. These objects survive as unreachable loose
// objects, and git is currently advising `git prune`, which removes every
// unreachable object regardless of age. notes/AUDIT-hash-recovery.md is the
// project-wide mapping built while they were still readable; consult it for
// REPAIR. This script is for not adding new ones.
import { execFileSync } from 'node:child_process';

const MAINLINE = process.env.MAINLINE ?? 'add-stick-and-city98';
// stderr swallowed: the misses are the NORMAL case here — most hash-shaped
// tokens are not commits — and letting git narrate each one buries the report
// under forty lines of `Not a valid object name`.
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

try { git('rev-parse', '--verify', MAINLINE); }
catch {
  console.error(`\n  cannot resolve mainline ref ${MAINLINE}.`);
  console.error(`  Set MAINLINE=<ref> if this repo calls it something else.\n`);
  process.exit(2);
}

// Text the project actually argues in. Binary and lockfiles are noise.
// Optional substring filters, so an owner can scope this to their own notes
// rather than reading everybody's:
//
//   node scripts/hashes-resolve.mjs A-          # just A's notes
//   node scripts/hashes-resolve.mjs BLOCKED- ct/props.ts
//
// Repo-wide is the default, because the number matters and scoping it away by
// default would hide it.
const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
// TRACKED **AND** NEW. `git ls-files` alone lists only tracked files, so a note
// you have just written is invisible to this until after you commit it — which
// is precisely one commit too late, since committing is what fixes the hashes
// in place. Found by writing a note full of citations, running this on it, and
// being told "nothing matches".
//
// --others --exclude-standard adds untracked files while still honouring
// .gitignore, so node_modules and dist stay out.
const files = [
  ...git('ls-files', '*.ts', '*.mjs', '*.md', '*.sh', '*.json').split('\n'),
  ...git('ls-files', '--others', '--exclude-standard', '*.ts', '*.mjs', '*.md', '*.sh', '*.json').split('\n'),
].filter(Boolean)
  .filter((f) => !f.includes('node_modules') && !f.endsWith('package-lock.json'))
  .filter((f) => !only.length || only.some((o) => f.includes(o)))
  // A RECOVERY TABLE IS NOT A CITATION. notes/AUDIT-hash-recovery.md exists to
  // list dead hashes and their landed twins, so flagging it is like flagging a
  // dictionary for containing the word it defines.
  //
  // I expected this to be most of the count and it is not: of 153 stranded
  // hashes, exactly TWO are cited only there — the table maps hashes that are
  // also being argued from in real notes, which is why it was built. So the
  // number stands at ~151 genuine dead citations and the exemption is for
  // correctness rather than to flatter the total.
  .filter((f) => !f.endsWith('AUDIT-hash-recovery.md'));

if (only.length && !files.length) {
  console.error(`\n  nothing matches ${only.join(' ')} — check the filter.\n`);
  process.exit(2);
}

const cited = new Map();          // hash -> [ "file:line", ... ]
for (const f of files) {
  let src;
  try { src = execFileSync('cat', [f], { encoding: 'utf8' }); } catch { continue; }
  src.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(/\b[0-9a-f]{7,10}\b/g)) {
      const h = m[0];
      if (!cited.has(h)) cited.set(h, []);
      if (cited.get(h).length < 4) cited.get(h).push(`${f}:${i + 1}`);
    }
  });
}

let commits = 0, stranded = [];
for (const [h, where] of cited) {
  // Not a commit -> not this check's business. Fingerprints land here, which is
  // the entire reason the assertion runs in this direction.
  try { git('cat-file', '-e', `${h}^{commit}`); } catch { continue; }
  commits++;
  try { git('merge-base', '--is-ancestor', h, MAINLINE); }
  catch { stranded.push([h, where]); }
}

console.log(`\n  ${cited.size} hash-shaped tokens in ${files.length} files;`
  + ` ${commits} of them are real commits`);

if (!stranded.length) {
  console.log(`  OK   every cited commit is reachable from ${MAINLINE}\n`);
  process.exit(0);
}

// THIS EVIDENCE IS PERISHABLE, and the repo is currently inviting its deletion.
// The stranded objects survive only as unreachable loose objects in this store —
// that is what makes them resolvable here and nowhere else, and it is also what
// lets this report name each replacement, since the landed twin is matched on
// the SUBJECT read off the stranded commit.
//
// git is presently printing "There are too many unreachable loose objects; run
// 'git prune'" on this repo (7336 loose against a 6700 auto-gc threshold).
// Automatic gc will NOT drop them yet — gc.pruneExpire defaults to 2 weeks and
// these are hours old — but the advice git volunteers is `git prune`, which
// takes them immediately. Run that before fixing these citations and every one
// of them becomes an unresolvable string with no way left to discover what it
// meant.
if (stranded.length) {
  console.log(`\n  NOTE: these resolve here only as unreachable loose objects.`);
  console.log(`  \`git prune\` / \`gc --prune=now\` deletes them and the replacement`);
  console.log(`  hashes below become undiscoverable. Fix the citations first.`);
}

console.log(`\n  ${stranded.length} cited commit${stranded.length > 1 ? 's are' : ' is'}`
  + ` NOT reachable from ${MAINLINE} — a fresh clone cannot resolve`
  + ` ${stranded.length > 1 ? 'them' : 'it'}:\n`);
for (const [h, where] of stranded) {
  let subj = '';
  try { subj = git('log', '-1', '--format=%s', h); } catch { /* gone */ }
  console.log(`  ${h}  ${subj.slice(0, 62)}`);
  console.log(`      cited at ${where.join(', ')}`);
  // The landed twin, matched on subject — a rebase rewrites the hash and keeps
  // the message, so this is usually the hash the note meant.
  if (subj) {
    let landed = '';
    try {
      // Split on the FIRST space, not at a fixed offset. This read l.slice(8)
      // and matched nothing, because %h is nine characters in this repo, not
      // eight — so every suggestion silently vanished and the report looked
      // like it simply had none to make.
      landed = git('log', '--format=%h %s', MAINLINE).split('\n')
        .find((l) => l.slice(l.indexOf(' ') + 1) === subj) ?? '';
    } catch { /* ignore */ }
    if (landed) {
      const twin = landed.slice(0, landed.indexOf(' '));
      // VERIFIED, NOT INFERRED — GOTCHAS 36 is explicit that the match is by
      // `git patch-id --stable` and not by subject, because two commits can
      // carry the same message and a wrong repair is worse than a dead hash:
      // the citation then points confidently at the wrong change. The subject
      // is only how the candidate is FOUND; the patch-id is whether it is right.
      let same = null;
      try {
        const idOf = (ref) => execFileSync('sh',
          ['-c', `git show ${ref} | git patch-id --stable`],
          { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split(' ')[0];
        const a = idOf(h), b = idOf(twin);
        same = a && b ? a === b : null;
      } catch { same = null; }
      const mark = same === true ? 'patch-id matches'
        : same === false ? 'PATCH-ID DIFFERS — same subject, different change; do NOT paste this'
        : 'patch-id not checkable here';
      console.log(`      landed as ${twin} — ${mark}`);
    }
  }
}
console.log('');
process.exit(1);
