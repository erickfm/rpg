// IS THE EVIDENCE I PUBLISHED STILL ON THE ROWS I PUT IT ON?
//
// Six verifier notes of mine have been added, committed, and later silently
// removed — the jail row twice. Every loss happened in a ledger conflict
// resolution: a row is one enormous line, so every concurrent append collides,
// and resolving by taking a side discards the other side's work. Nothing fails.
// The row still renders. `live.sh` still parses it. I only ever found out by
// going back to re-read my own note.
//
// Re-attaching by hand each time is not a fix; it is a chore that hides the
// frequency. This turns the loss into a red check.
//
// WHY THIS IS NARROW AND MINE. It asserts nothing about anyone else's evidence —
// I cannot know what somebody else meant to publish, and a check that guessed
// would be noise. It knows only what *I* published, because I wrote it down
// here when I published it. Whoever else keeps losing notes can keep their own
// manifest; the mechanism is the cheap part.
//
// TWO OF THESE ARE CORRECTIONS, NOT CORROBORATION, and that is the distinction
// that makes the check worth registering: losing corroboration costs a re-walk,
// but losing a correction leaves a false claim standing under a status nobody
// will look at again — the bank row's superlative is wrong against the very
// table it cites, and my note saying so has already been eaten twice.
//
//   node scripts/D-my-evidence-intact.mjs [--selftest]
import { readFileSync } from 'node:fs';

for (const a of process.argv.slice(2)) {
  if (a !== '--selftest') {
    console.error(`unknown argument ${JSON.stringify(a)} — this script takes --selftest and nothing else`);
    process.exit(2);
  }
}
const SELFTEST = process.argv.includes('--selftest');

/** row key → a phrase unique to the note I published on it, and what kind it is */
const MINE = [
  ['also we need a jail',                  '2.100 m WEST',                    'correction: geometry crosses the published site line'],
  ['when the player goes to sleep',        'fully black in 10 of 140',        'corroboration: the fade holds, third tree'],
  ['create a whole interior for the bank', '5th of 12',                       'CORRECTION: the row\'s superlative is false'],
  ['make sure the people in the buildings','column 0',                        'corroboration: the keeper faces the customer'],
  ['stealing a package',                   'int-burger.ts` and `int-thrift.ts','correction: the refusal is bypassed by two writers'],
  ['a casino slot stool opens a modal',    'THE TRAP NO LONGER REPRODUCES',   'CORRECTION: a CONFIRMED bug that is over'],
  ['i need much more diversity on the ads','silently fixed the shuffle fault','corroboration: ten formats, and my old fault is gone'],
  ['pressing e doesnt get me out of it',   '149 of 225 seats',                'corroboration: the resolver bypass is correct'],
];

const rows = readFileSync('notes/LEDGER.md', 'utf8').split('\n').filter((l) => l.startsWith('|'));
// ALL rows bearing that request text, not the first. The ledger has THREE rows
// whose request begins "pressing e doesnt get me out of it" — the user filed it
// more than once and the desk kept them separate — and my note sits on the
// third. Taking `find` reported it LOST and I nearly filed a seventh loss that
// had not happened. A key identifies a request, not a row.
const rowsFor = (key) => rows.filter((l) => l.split('|')[3]?.includes(key));

let gone = 0, noRow = 0;
console.log('');
for (const [key, needle, kind] of MINE) {
  const rs = rowsFor(key);
  if (!rs.length) { noRow++; console.log(`  ROW GONE  ${key} — no row in the ledger carries this request`); continue; }
  if (!rs.some((r) => r.includes(needle))) {
    gone++;
    console.log(`  LOST      ${key}${rs.length > 1 ? `  (checked all ${rs.length} rows with this request)` : ''}`);
    console.log(`            ${kind}`);
  }
}
const ok = MINE.length - gone - noRow;
console.log(`\n  ${ok} of ${MINE.length} notes still attached${gone ? `, ${gone} LOST` : ''}${noRow ? `, ${noRow} whose row has vanished` : ''}`);

if (SELFTEST) {
  console.log('\nselftest — a needle that cannot be there must be reported LOST');
  const rs = rowsFor(MINE[0][0]);
  const caught = rs.length > 0 && !rs.some((r) => r.includes('ZZQX-this-phrase-is-not-in-any-row'));
  console.log(caught
    ? '\nSELFTEST PASSED — an absent needle on a present row is detectable'
    : '\nSELFTEST FAILED');
  process.exit(caught ? 0 : 1);
}

if (gone || noRow) {
  console.log('\n  Evidence was published and is no longer there. Re-attach it, and when you resolve');
  console.log('  a ledger conflict MERGE the row rather than taking a side — both sides are almost');
  console.log('  always appends to the same cell.');
  process.exit(1);
}
console.log('  every note I published is still on its row');
