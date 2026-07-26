// RE-RUNNING AUDIT's SWEEP: what does each CONFIRMED row actually rest on?
//
// AUDIT's row states the numbers at build 75f8b9abe — 171 CONFIRMED, 109 with
// auditor evidence, 34 naming a verifier or a station, **28 naming nobody and
// nothing** — and names the station as "re-run the sweep".
//
// So this re-runs it. The interesting question is not whether the count was
// right then; it is whether the re-evidencing round the desk called for
// actually moved it, and that can only be answered by counting again.
//
// THE PREDICATE, written down before running so it cannot be tuned to the
// answer. A row rests on SOMETHING if its evidence cell contains any of:
//
//   · an auditor's mark        AUDITOR / audit/ / — auditor
//   · a named verifier         "CONFIRMED by X" or a trailing "— X"
//   · a station                STATION / STAND AT / CHECK FROM / WHERE TO STAND
//   · a predicate              PREDICATE / node scripts/ / npm run
//
// Anything else names nobody and nothing. A shot filename is NOT a station: it
// says what was seen, not where to stand to see it again, which is the whole
// distinction AUDIT drew.
import { readFileSync } from 'node:fs';

const rows = [];
for (const line of readFileSync('notes/LEDGER.md', 'utf8').split('\n')) {
  if (!line.startsWith('| ')) continue;
  const f = line.split('|');
  if (f.length < 5) continue;
  const status = f[1].trim(), owner = f[2].trim(), title = f[3].trim();
  if (!title || /^-+$/.test(title) || status === 'STATUS') continue;
  rows.push({ status, owner, title, ev: f.slice(4).join('|') });
}

const auditor  = (e) => /AUDITOR|audit\/|—\s*auditor/i.test(e);
const verifier = (e) => /CONFIRMED by\s+\w|VERIFIER|—\s*[A-Z]{1,5}\s*$|\(verifier/i.test(e);
const station  = (e) => /STATION|STAND AT|CHECK FROM|WHERE TO STAND|STAND IN|STAND ON/i.test(e);
const predicate = (e) => /PREDICATE|node scripts\/|npm run /i.test(e);

const confirmed = rows.filter((r) => r.status === 'CONFIRMED');
const bare = confirmed.filter((r) =>
  !auditor(r.ev) && !verifier(r.ev) && !station(r.ev) && !predicate(r.ev));
const withAuditor = confirmed.filter((r) => auditor(r.ev));
const withOther = confirmed.filter((r) => !auditor(r.ev)
  && (verifier(r.ev) || station(r.ev) || predicate(r.ev)));

console.log(`\n── every row in the ledger ──`);
const byStatus = {};
for (const r of rows) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
console.log('  ' + Object.entries(byStatus).sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `${k} ${v}`).join('   '));

console.log(`\n── what the ${confirmed.length} CONFIRMED rows rest on ──`);
console.log(`  carrying auditor evidence                 ${String(withAuditor.length).padStart(4)}`);
console.log(`  naming a verifier, a station or a predicate ${String(withOther.length).padStart(3)}`);
console.log(`  NAMING NOBODY AND NOTHING                 ${String(bare.length).padStart(4)}`);
console.log(`\n  AUDIT's sweep at build 75f8b9abe: 171 confirmed, 109 / 34 / 28`);

if (bare.length) {
  const byOwner = {};
  for (const r of bare) byOwner[r.owner] = (byOwner[r.owner] ?? 0) + 1;
  console.log(`\n  the remaining bare rows, by owner: ` +
    Object.entries(byOwner).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
  console.log('  thinnest first:');
  for (const r of bare.slice().sort((a, b) => a.ev.length - b.ev.length).slice(0, 14)) {
    console.log(`    ${String(r.ev.trim().length).padStart(5)} chars  [${r.owner}] ${r.title.slice(0, 58)}`);
  }
}

// the other half of AUDIT's own finding, worth carrying forward
// AND THE OTHER HALF OF AUDIT's FINDING — BUT NOT BY GREP.
//
// Matching /CANNOT ANSWER/ over the evidence returns SEVEN rows, and I nearly
// reported that as "bigger than AUDIT found". Reading the seven matches instead
// of trusting them: SIX are NARRATIVE, and several are describing the fix —
// "that is the auditor's 'cannot be decided by its own check', in my own file.
// FIXED by…", "it now returns -1, 'cannot answer', when it has fewer than three
// assemblies", "pos()[1] cannot answer 'did I sit', so I checked what I was
// measuring". Those are builders explaining how they made a check honest.
//
// A phrase in a paragraph is not a state. So this prints the candidates and
// REFUSES to give a count, because the only way to tell them apart is to read
// them, and a number here would be a claim the script cannot support.
const cannot = confirmed.filter((r) => /CANNOT ANSWER|cannot be decided|cannot decide/i.test(r.ev));
console.log(`\n── rows whose evidence MENTIONS "cannot answer": ${cannot.length} candidates ──`);
console.log(`  NOT a count of broken checks. Six of these seven are narrative — several`);
console.log(`  describe the FIX. Read each before acting; a phrase is not a state.`);
for (const r of cannot) console.log(`    [${r.owner}] ${r.title.slice(0, 62)}`);
console.log(`\n  AUDIT named ONE genuine case (F, wheel arches) and that reading holds.`);
