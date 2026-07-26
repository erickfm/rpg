// WHAT DOES EACH CONFIRMED ROW ACTUALLY REST ON? The auditor's sweep, re-run.
//
// The auditor's row asks for exactly this as its station: "count CONFIRMED rows
// containing neither AUDITOR nor a verifier marker". They have already had to
// correct their own figure once, because the first sweep matched `AUDITOR`
// CASE-SENSITIVELY and several rows carry their evidence as "— auditor —".
//
// So the predicate is the whole finding here, and it is stated rather than
// buried. A row COUNTS AS EVIDENCED if its evidence mentions any of:
//
//   an auditor        AUDITOR / auditor
//   a named verifier  VERIFIER / CONFIRMED by X / verifying
//   somewhere to go   STATION / CHECK FROM / WHERE TO STAND
//   a desk ruling     desk ruling / DESK:
//   a runnable check  scripts/<something>.mjs
//
// The last one is deliberate and is a judgement I am exposing rather than
// hiding: a row that names a script anyone can run is not resting on nothing,
// even if no human is named beside it. Drop that clause and the count rises —
// the flag below prints both so nobody has to take my word for which they want.
//
//   node scripts/A-confirmed-rests-on.mjs            # counts
//   node scripts/A-confirmed-rests-on.mjs --list     # the bare rows, by owner
import { readFileSync } from 'node:fs';

const LIST = process.argv.includes('--list');
const BAD = process.argv.slice(2).filter((a) => a !== '--list');
if (BAD.length) {
  console.error(`\n  CANNOT USE THESE ARGUMENTS: ${BAD.join(' ')}. Nothing was counted.`);
  console.error('  give nothing, or --list\n');
  process.exit(2);
}

const rows = readFileSync('notes/LEDGER.md', 'utf8').split('\n')
  .filter((l) => /^\|\s*CONFIRMED\s*\|/i.test(l))
  .map((l) => {
    const c = l.split('|');
    return { owner: (c[2] ?? '').trim(), req: (c[3] ?? '').trim(), ev: c.slice(4).join('|').trim() };
  });

if (!rows.length) {
  console.error('\nCANNOT ANSWER — no CONFIRMED rows found; nothing was counted.\n');
  process.exit(3);                                    // GOTCHAS 32/34
}

// MY FIRST PATTERN WAS TOO NARROW AND UNDERCOUNTED THE EVIDENCED ROWS. It
// missed `RE-EVIDENCED by E … PREDICATE:` — three of E's rows carry their
// account in exactly that form — so it reported them as resting on nothing
// when they name both a person and a predicate. Which is the same mistake the
// auditor made with case-sensitive `AUDITOR`, one synonym over: when the
// predicate IS the finding, every word it does not know is a false positive.
const HUMAN = /auditor|verifier|confirmed by|verifying|re-evidenced|predicate|station|check from|where to stand|desk ruling|desk:/i;
const SCRIPT = /scripts\/[A-Za-z0-9_.-]+\.mjs|\bnpm run\b/;

const bareStrict = rows.filter((r) => !HUMAN.test(r.ev));                 // no human, no station
const bareLoose = bareStrict.filter((r) => !SCRIPT.test(r.ev));           // …and no runnable check either

const byOwner = (set) => {
  const t = {};
  for (const r of set) t[r.owner || '?'] = (t[r.owner || '?'] ?? 0) + 1;
  return Object.entries(t).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ');
};

console.log(`\n${rows.length} CONFIRMED rows\n`);
console.log(`  ${String(rows.length - bareStrict.length).padStart(3)}  name an auditor, a verifier, or somewhere to stand`);
console.log(`  ${String(bareStrict.length).padStart(3)}  name NEITHER  — by owner: ${byOwner(bareStrict) || 'none'}`);
console.log(`  ${String(bareLoose.length).padStart(3)}  …and do not name a runnable check either`);
console.log(`       by owner: ${byOwner(bareLoose) || 'none'}`);

if (LIST && bareLoose.length) {
  console.log(`\nrows resting on nothing at all:`);
  for (const r of bareLoose) {
    console.log(`  [${r.owner}] ${r.req.slice(0, 58)}`);
    console.log(`        ${(r.ev.replace(/\s+/g, ' ').slice(0, 90)) || '(empty)'}`);
  }
}

console.log(`\nThe difference between the two counts is one judgement, printed so it can`);
console.log(`be argued with: a row naming a script anyone can run is not resting on`);
console.log(`nothing, even with no human beside it.`);
