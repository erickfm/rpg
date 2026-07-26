// DOES EVERY ROW'S STATUS AGREE WITH ITS OWN EVIDENCE?
//
// `LEDGER.md` is the file the desk reads before telling the user something is
// finished, and it has been losing content. The auditor found eleven rows
// dropped in one sweep and one commit that dropped four at once; K reports a row
// that lost its LANDED status AND its closing pipe; five verifier notes of mine
// have been removed after being committed. Every one of those went in a CONFLICT
// RESOLUTION, because a ledger row is a single enormous line — so every
// concurrent append collides, and resolving by choosing a side silently discards
// the other side's work.
//
// None of it fails anything. The row still renders. `live.sh` still parses it.
//
// This catches the one part of that damage which is mechanically detectable: a
// row whose EVIDENCE says an auditor confirmed it while its STATUS says
// otherwise. Those two cells are written at different times by different people,
// so when they disagree, one of them has been rolled back.
//
// It is deliberately NARROW. It does not check for lost prose — there is no way
// to miss what was never there — and it does not check the closing pipe or cell
// counts, because 35 rows are already uneven and a check red on 35 rows nobody
// owns is C's `mods-dim` lesson: *"reddening the shared suite over something I
// cannot fix would hand the block my problem."* One question, answerable, and
// the answer is a short list of rows a human can settle.
//
//   node scripts/D-ledger-status-vs-evidence.mjs [--selftest]
import { readFileSync } from 'node:fs';

for (const a of process.argv.slice(2)) {
  if (a !== '--selftest') {
    console.error(`unknown argument ${JSON.stringify(a)} — this script takes --selftest and nothing else`);
    process.exit(2);
  }
}
const SELFTEST = process.argv.includes('--selftest');

/** the evidence cell is claiming somebody with standing signed it off */
const CLAIMS_CONFIRMED =
  /AUDITOR CONFIRMED|AUDITOR: CONFIRMED|AUDITOR RESTORES CONFIRMED|CONFIRMED by (?:the auditor|[A-Z] \(verifier\))/;

const rows = readFileSync('notes/LEDGER.md', 'utf8').split('\n')
  .map((line, i) => ({ line, n: i + 1 }))
  .filter((r) => r.line.startsWith('|'));

const bad = [];
for (const { line, n } of rows) {
  const c = line.split('|');
  if (c.length < 5) continue;
  const status = c[1].trim(), owner = c[2].trim(), req = c[3].trim();
  const ev = c.slice(4).join('|');
  if (!/^(OPEN|LANDED)$/.test(status)) continue;
  if (!CLAIMS_CONFIRMED.test(ev)) continue;
  const m = ev.match(new RegExp(`(.{0,40}${CLAIMS_CONFIRMED.source}.{0,40})`));
  bad.push({ n, status, owner, req: req.slice(0, 50), quote: (m ? m[1] : '').replace(/\s+/g, ' ').trim() });
}

console.log(`\n  ${rows.length} ledger rows · ${bad.length} whose STATUS disagrees with their own EVIDENCE\n`);
for (const b of bad) {
  console.log(`  line ${b.n}: status ${b.status}, owner ${b.owner} — ${b.req}`);
  console.log(`      its evidence says: …${b.quote}…`);
}

if (SELFTEST) {
  // The honest self-test is that the predicate FIRES on a row shaped like the
  // damage. Build one in memory rather than editing the ledger to prove it.
  console.log('\nselftest — a planted mismatch must be CAUGHT');
  const planted = '| OPEN | Z | a planted row | **AUDITOR CONFIRMED (build deadbeef).** |';
  const c = planted.split('|');
  const caught = /^(OPEN|LANDED)$/.test(c[1].trim()) && CLAIMS_CONFIRMED.test(c.slice(4).join('|'));
  console.log(caught
    ? '\nSELFTEST PASSED — an OPEN row carrying an auditor confirmation is detected'
    : '\nSELFTEST FAILED — the predicate does not fire on the damage it exists for');
  process.exit(caught ? 0 : 1);
}

if (bad.length) {
  console.log('\n  Each of these had a status set and then rolled back, or evidence attached to the');
  console.log('  wrong row. Only the desk can settle which — a builder may not set CONFIRMED.');
  process.exit(1);
}
console.log('  every row\'s status agrees with its evidence');
