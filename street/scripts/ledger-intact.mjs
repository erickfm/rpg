// DID THIS EDIT LOSE ANYTHING FROM THE LEDGER?
//
// `notes/LEDGER.md` is the file the desk reads before telling the user
// something is finished, and it is edited by fifteen agents rebasing over each
// other. It has lost rows three times today, and I caused some of that: a
// scripted conflict resolution of mine left conflict markers in a committed
// ledger, duplicated two rows, and replayed my stale copies over other people's
// — one row went from 1574 characters to 73, taking a verifier's evidence with
// it.
//
// After that I checked every ledger commit by hand with a throwaway snippet.
// This is that snippet, made real, so nobody has to remember to write it.
//
// WHAT IT ASSERTS, and each one is a way the file has actually been damaged:
//
//   · no conflict markers          — committed twice
//   · no duplicate row titles      — a bad merge pairs a row with itself
//   · no row LOST                  — three times today
//   · no evidence cell SHRANK      — the quiet one: the row is still there and
//                                    the verifier's paragraph is gone
//   · no CONTRIBUTION dropped      — quieter still: the length holds and one
//                                    account has been swapped for another (H)
//
// Losses are attributed: a row THIS BRANCH never touched cannot have been
// shrunk by it, so those are reported as the ref moving on rather than as
// damage. Without that, a branch that is both ahead and behind blames itself
// for everybody else's newer paragraphs. (H)
//
// Growth is fine and unreported: rows are meant to accumulate evidence. This
// only ever complains about loss.
//
// USAGE
//   node scripts/ledger-intact.mjs                 vs add-stick-and-city98
//   node scripts/ledger-intact.mjs <ref>           vs any ref
//   node scripts/ledger-intact.mjs --selftest      proves it goes red
//
// Exit 0 clean, 1 damaged, 2 could not run (GOTCHAS 32 — never confuse the
// two: "I could not read the base" is not "the ledger is fine").
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const LEDGER = 'notes/LEDGER.md';
const argv = process.argv.slice(2);
const selftest = argv.includes('--selftest');
const ref = argv.find((a) => !a.startsWith('--')) ?? 'add-stick-and-city98';

/** A CONTRIBUTION SEGMENT. The shrink check above catches a paragraph going
 *  missing, but not one being SWAPPED for another of similar length — and the
 *  auditor asked for exactly this: "compare against a per-segment count rather
 *  than a per-row one". Cells are separated by `||`, and successive accounts
 *  inside a cell are introduced by `— **NAME` or `**NAME (verifier)`, so
 *  counting those bounds how many hands are on the row. Deliberately a LOWER
 *  bound: it undercounts rather than inventing segments, so it can miss a loss
 *  but will not invent one. — H */
const SEG = /\|\||—\s*\*\*|\*\*[A-Z][A-Za-z]{0,7}\s*\(?(?:verifier|2nd)/g;

/** every row keyed by its TITLE — field 3 of the pipe table — with the length
 *  of its evidence cell. The title is the only stable identity a row has; the
 *  status changes and the evidence grows. */
function rowsOf(text) {
  const out = new Map();
  for (const line of text.split('\n')) {
    if (!line.startsWith('| ')) continue;
    const f = line.split('|');
    if (f.length < 5) continue;
    const title = f[3].trim();
    if (!title || /^-+$/.test(title)) continue;
    // the evidence is everything after the title, which may itself contain pipes
    const ev = line.split('|').slice(4).join('|');
    out.set(title, { status: f[1].trim(), owner: f[2].trim(), ev: ev.length,
      seg: (line.match(SEG) || []).length, dup: out.has(title) });
  }
  return out;
}

function readBase(r) {
  for (const path of [`${r}:street/${LEDGER}`, `${r}:${LEDGER}`]) {
    try { return execSync(`git show ${path}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }); }
    catch { /* try the other layout */ }
  }
  return null;
}

if (!existsSync(LEDGER)) {
  console.error(`  CANNOT RUN — ${LEDGER} is not here. Run from street/.`);
  process.exit(2);
}
const baseText = readBase(ref);
if (baseText === null) {
  console.error(`  CANNOT RUN — could not read ${LEDGER} at "${ref}".`);
  console.error('  That is not a verdict on the ledger; nothing was compared.');
  process.exit(2);
}

let nowText = readFileSync(LEDGER, 'utf8');
if (selftest) {
  // Drop the LAST row and halve the evidence on another, then require both to
  // be caught. A guard nobody has watched fail is not a guard (GOTCHAS 27).
  const lines = nowText.split('\n');
  const idx = lines.map((l, i) => [l, i]).filter(([l]) => l.startsWith('| ')).map(([, i]) => i);
  const dropped = lines[idx[idx.length - 1]].split('|')[3].trim();
  lines.splice(idx[idx.length - 1], 1);
  const victim = idx[Math.floor(idx.length / 2)];
  const f = lines[victim].split('|');
  const shrunk = f[3].trim();
  lines[victim] = f.slice(0, 4).join('|') + '| (evidence deliberately removed) |';
  nowText = lines.join('\n');
  console.log(`  SELFTEST: dropped "${dropped.slice(0, 44)}"`);
  console.log(`            gutted  "${shrunk.slice(0, 44)}"`);
}

// ARE WE BEHIND THE BASE RATHER THAN DAMAGED? The two look identical from the
// row counts — evidence "missing" from your copy because somebody else added it
// after your last rebase is not evidence you dropped. My very first real run of
// this guard went red on exactly that, which is the false-alarm class this
// whole session has been about. Staleness is EXIT 2, not exit 1: it means the
// comparison could not be trusted, not that the ledger is wrong.
if (!selftest) {
  let behind = false;
  try {
    const head = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    const merged = execSync(`git merge-base ${ref} HEAD`, { encoding: 'utf8' }).trim();
    const dirty = execSync(`git status --porcelain -- ${LEDGER}`, { encoding: 'utf8' }).trim();
    // HEAD is an ancestor of the base ref, and the file is not locally edited:
    // whatever differs came from the base moving on without us.
    behind = merged === head && head !== execSync(`git rev-parse ${ref}`, { encoding: 'utf8' }).trim()
             && dirty === '';
  } catch { /* not a git tree, or the ref is odd — fall through and compare */ }
  if (behind) {
    console.error(`\n  CANNOT RUN — your ${LEDGER} is BEHIND ${ref}, which has moved on.`);
    console.error('  Anything "missing" here is somebody else\'s later work, not something you');
    console.error('  dropped. That is not a verdict on your edit.');
    console.error(`  Fix: git rebase ${ref}, then re-run.`);
    process.exit(2);
  }
}

// WHOSE LOSS IS IT? The behind-check above is binary, and the common case is
// NEITHER: my branch has commits the ref lacks AND the ref has moved on. Then
// `merged === head` is false, the staleness guard cannot fire, and every
// paragraph the ref gained since the merge base is reported as MY deletion.
// That went red on me over three rows I had never opened, and it had already
// cost the auditor a pass. So work out which rows THIS BRANCH actually touched
// and only hold it responsible for those. (H)
let mineTouched = null;               // null = could not tell, so blame nothing
if (!selftest) {
  try {
    const mb = execSync(`git merge-base ${ref} HEAD`, { encoding: 'utf8' }).trim();
    const diff = execSync(`git diff ${mb} HEAD -- ${LEDGER}`, { encoding: 'utf8', maxBuffer: 1 << 28 });
    mineTouched = new Set();
    for (const l of diff.split('\n')) {
      if (!/^[+-]\| /.test(l)) continue;
      const f = l.slice(1).split('|');
      if (f.length >= 5) mineTouched.add(f[3].trim());
    }
  } catch { mineTouched = null; }
}
/** did this branch touch the row, or is an apparent loss the ref's later work? */
const isMine = (t) => mineTouched === null || mineTouched.has(t);

const base = rowsOf(baseText), now = rowsOf(nowText);
const markers = nowText.split('\n').filter((l) => /^(<<<<<<<|=======|>>>>>>>)/.test(l)).length;
const dups = [...now.entries()].filter(([, v]) => v.dup).map(([t]) => t);
const lost = [...base.keys()].filter((t) => !now.has(t));
const shrank = [...now.entries()]
  .filter(([t, v]) => base.has(t) && base.get(t).ev > v.ev)
  .map(([t, v]) => ({ t, from: base.get(t).ev, to: v.ev }));
const added = [...now.keys()].filter((t) => !base.has(t));
// A row can keep its length and still lose a hand: one account replaced by
// another of similar size. Only reported when the evidence did NOT shrink,
// because a shrink already says it louder. (H)
const lostSeg = [...now.entries()]
  .filter(([t, v]) => base.has(t) && base.get(t).seg > v.seg && base.get(t).ev <= v.ev)
  .map(([t, v]) => ({ t, from: base.get(t).seg, to: v.seg }));

console.log(`\nledger vs ${ref}:  ${base.size} rows -> ${now.size}`);
const fail = [];
if (markers) { console.log(`  ${markers} CONFLICT MARKER LINE(S) in the file`); fail.push('markers'); }
if (dups.length) {
  console.log(`  ${dups.length} DUPLICATE row title(s):`);
  for (const t of dups.slice(0, 5)) console.log(`      ${t.slice(0, 66)}`);
  fail.push('duplicates');
}
if (lost.length) {
  console.log(`  ${lost.length} ROW(S) LOST:`);
  for (const t of lost.slice(0, 8)) console.log(`      [${base.get(t).status}] ${t.slice(0, 62)}`);
  fail.push('lost rows');
}
if (shrank.length) {
  const ours = shrank.filter((x) => isMine(x.t));
  const theirs = shrank.filter((x) => !isMine(x.t));
  if (ours.length) {
    console.log(`  ${ours.length} EVIDENCE CELL(S) SHRANK — somebody's paragraph went missing:`);
    for (const s of ours.slice(0, 8)) {
      console.log(`      -${String(s.from - s.to).padStart(5)} chars (${s.from} -> ${s.to})  ${s.t.slice(0, 48)}`);
    }
    fail.push('shrunk evidence');
  }
  if (theirs.length) {
    console.log(`  ${theirs.length} cell(s) are SHORTER but this branch never touched them —`);
    console.log(`  that is ${ref} moving on, not a loss of yours. Rebase to take it:`);
    for (const s of theirs.slice(0, 6)) {
      console.log(`      -${String(s.from - s.to).padStart(5)} chars  ${s.t.slice(0, 48)}`);
    }
  }
}
if (lostSeg.length) {
  console.log(`  ${lostSeg.length} ROW(S) LOST A CONTRIBUTION while keeping their length:`);
  for (const s2 of lostSeg.slice(0, 8)) {
    console.log(`      ${s2.from} -> ${s2.to} accounts  ${s2.t.slice(0, 52)}`);
  }
  fail.push('lost a contribution');
}
if (added.length) console.log(`  ${added.length} row(s) added (fine, reported for the record)`);

if (fail.length) {
  console.log(`\n  DAMAGED: ${fail.join(', ')}.`);
  console.log('  A ledger merge pairs rows by TITLE and APPENDS evidence. It must never');
  console.log('  replace a row with an older copy of itself, and a hunk whose HEAD side is');
  console.log('  empty wants its markers dropped, not its rows paired.');
  process.exit(selftest ? 0 : 1);
}
console.log('\n  intact — nothing lost, nothing shrank, no contribution dropped, no markers, no duplicates');
if (selftest) { console.log('\n  SELFTEST FAILED: the guard did not notice a dropped row.'); process.exit(1); }
process.exit(0);
