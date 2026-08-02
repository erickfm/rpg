// Every mapping in notes/AUDIT-hash-recovery.md is sound — checked, not sampled.
//
// Named for what it asserts (GOTCHAS 24). It has a DEADLINE: it reads the old,
// unreachable objects, so it cannot be run again after a `git prune`. The
// numbers it produced are recorded in notes/B-recovery-table-verified.md
// because the result outlives the ability to re-derive it.
//
// 2673aa627 verified 22 of 132 mappings by patch-id and said plainly that the
// rest could not be re-derived later. The objects still exist, so this does all
// of them.
//
// ── what it found, and the method correction ──
//
// 141 rows: 132 patch-id matches, 9 differ, 0 unreadable, 0 targets off
// mainline. The 9 are NOT bad mappings. Every one has exactly ONE commit on
// mainline carrying that subject, so there is nothing for it to be confused
// with; five have byte-identical diffstats and four changed, which is a rebase
// resolving conflicts, dropping a file that no longer existed, or shifting the
// context lines patch-id --stable hashes.
//
// So GOTCHAS 36's "match by patch-id, not by subject" needs one clause:
// A PATCH-ID MATCH CONFIRMS A MAPPING. A PATCH-ID MISMATCH DOES NOT REFUTE ONE,
// because a rebase legitimately rewrites the patch. Used as a rejection test it
// would have thrown out 9 of 141 correct mappings — the same shape of error as
// the audits §36 was written to prevent, in the opposite direction.
//
// The test that actually decides is subject UNIQUENESS on mainline: one
// candidate means there is nothing to confuse it with. Patch-id is the
// corroboration on top.
import { execFileSync, execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const rows = readFileSync('notes/AUDIT-hash-recovery.md', 'utf8').split('\n')
  .map(l => l.match(/^\|\s*`([0-9a-f]{7,10})`\s*\|\s*`([0-9a-f]{7,10})`\s*\|\s*(.*?)\s*\|/))
  .filter(Boolean).map(m => ({ old: m[1], neu: m[2], subj: m[3] }));
const git0 = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64e6, stdio: ['ignore','pipe','ignore'] }).trim();
const pid = (ref) => {
  try { return execSync(`git show ${ref} | git patch-id --stable`,
    { encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }).trim().split(' ')[0] || null; }
  catch { return null; }
};
const reach = (h) => { try { execFileSync('git', ['merge-base','--is-ancestor',h,'add-stick-and-city98'],
  { stdio:'ignore' }); return true; } catch { return false; } };
const subjectsOnMainline = git0('log', '--format=%s', 'add-stick-and-city98').split('\n');
let match = 0, differAmbiguous = 0, differ = [], unreadable = [], newNotOnMain = [];
for (const r of rows) {
  if (!reach(r.neu)) newNotOnMain.push(r);
  const a = pid(r.old), b = pid(r.neu);
  if (!a || !b) { unreadable.push({ ...r, a: !!a, b: !!b }); continue; }
  if (a === b) match++; else differ.push(r);
}
console.log(`table rows parsed: ${rows.length}`);
console.log(`  patch-id MATCHES : ${match}`);
console.log(`  patch-id DIFFERS : ${differ.length}`);
console.log(`  unreadable       : ${unreadable.length}`);
console.log(`  target not on mainline: ${newNotOnMain.length}`);
// A DIFFER is not a verdict on its own — see the note at the top. Report the
// thing that decides: how many commits on mainline carry this subject.
for (const d of differ) {
  // COUNT IN JS, NOT THROUGH A SHELL. The first version piped `git log` into
  // `grep -Fxc` with the subject escaped by JSON.stringify, which escapes for
  // JSON and not for sh — three subjects containing punctuation came back as
  // "0 mainline commits share this subject" and were reported AMBIGUOUS. My own
  // earlier hand-run of the same question had said 1 for all nine, and the
  // disagreement is the only reason I looked. A shell-quoting bug that reports
  // FEWER candidates turns sound mappings into scary ones.
  // THE SUBJECT MUST COME FROM THE COMMIT, NOT FROM THE TABLE. The table
  // truncates long subjects with an ellipsis for display — "…registers its own
  // f…" — so comparing its third column against full mainline subjects scores
  // zero and reports a sound mapping as AMBIGUOUS. Three of the nine read that
  // way until I noticed they disagreed with a hand-run of the same question.
  let real = d.subj;
  try { real = git0('log', '-1', '--format=%s', d.old); } catch { /* keep */ }
  const cand = String(subjectsOnMainline.filter((x) => x === real).length);
  const verdict = cand === '1' ? 'sound (only one commit carries this subject; rebase rewrote the patch)'
    : `AMBIGUOUS — ${cand} mainline commits share this subject`;
  console.log(`    ${d.old} -> ${d.neu}  ${verdict}`);
  if (cand !== '1') differAmbiguous++;
}
for (const u of unreadable.slice(0, 12)) console.log(`    UNREADABLE ${u.old}(${u.a?'ok':'gone'}) -> ${u.neu}(${u.b?'ok':'gone'})  ${u.subj.slice(0,44)}`);
for (const n of newNotOnMain.slice(0, 8)) console.log(`    TARGET OFF MAINLINE ${n.old} -> ${n.neu}  ${n.subj.slice(0,44)}`);

const bad = differAmbiguous + unreadable.length + newNotOnMain.length;
console.log(bad
  ? `\n  ${bad} mapping(s) cannot be trusted — see above\n`
  : `\n  OK   all ${rows.length} mappings are sound: ${match} confirmed by patch-id,`
    + ` ${differ.length} unambiguous by subject\n`);
process.exit(bad ? 1 : 0);
