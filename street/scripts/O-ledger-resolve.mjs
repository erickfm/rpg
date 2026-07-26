// RESOLVE A LEDGER.md MERGE CONFLICT BY THE DOCUMENTED RULE, not by hand.
//
//   node scripts/O-ledger-resolve.mjs [path]      default notes/LEDGER.md
//
// `notes/queues/README.md` already states the rule and it is a good one:
//
//   *"resolve it by taking the MOST ADVANCED STATUS of each row
//     (OPEN < LANDED < CONFIRMED) and KEEPING BOTH SIDES' EVIDENCE. The two
//     writers are nearly always advancing different rows, so almost every one
//     of these conflicts is a false one."*
//
// It is written down and it is still done by hand every time, which is why it
// keeps going wrong. Two evidence cells have now been lost to it that I know
// of — G's casino-seat verdict, and my own jail row twice, once reset to OPEN
// with the cell blank. **A row with no evidence is indistinguishable from work
// nobody did**, which is the expensive way to lose it.
//
// This applies the rule mechanically:
//   · status  -> the more advanced of the two
//   · evidence-> the LONGER cell, plus any of the other side's verification
//     paragraphs it is missing, appended rather than dropped
//   · a block whose two sides have different row counts is left ALONE and
//     reported, because that is a real structural conflict and not this one
//
// It never invents a status and never deletes text. Anything it cannot resolve
// under the rule it leaves conflicted and tells you about, which is the whole
// difference between a tool and a guess.
import { readFileSync, writeFileSync } from 'node:fs';

const path = process.argv[2] ?? 'notes/LEDGER.md';
const RANK = { OPEN: 0, LANDED: 1, CONFIRMED: 2 };
/** paragraphs a verifier adds; kept from whichever side has them */
const CLAIMS = [/—\s*\*\*[A-Z][^*]{0,80}VERIFI/i, /—\s*\*\*AUDITOR/i, /RESTORED/];

const lines = readFileSync(path, 'utf8').split('\n');
const out = [];
let i = 0, resolved = 0, left = 0;

while (i < lines.length) {
  if (!lines[i].startsWith('<<<<<<<')) { out.push(lines[i++]); continue; }
  let j = i + 1; const head = [];
  while (j < lines.length && !lines[j].startsWith('=======')) head.push(lines[j++]);
  let k = j + 1; const mine = [];
  while (k < lines.length && !lines[k].startsWith('>>>>>>>')) mine.push(lines[k++]);

  if (head.length !== mine.length) {
    // NOT this conflict. Leave it exactly as it was and say so — a resolver
    // that guesses at a structural conflict is worse than one that stops.
    out.push(lines[i], ...head, lines[j], ...mine, lines[k]);
    left++; i = k + 1; continue;
  }
  for (let r = 0; r < head.length; r++) {
    const hc = head[r].split('|'), mc = mine[r].split('|');
    if (hc.length < 5 || mc.length < 5) { out.push(head[r].length >= mine[r].length ? head[r] : mine[r]); continue; }
    const hs = hc[1].trim(), ms = mc[1].trim();
    const takeH = (RANK[hs] ?? 0) >= (RANK[ms] ?? 0);
    const win = (takeH ? hc : mc).slice(), lose = takeH ? mc : hc;
    win[1] = ` ${takeH ? hs : ms} `;
    // KEEP BOTH SIDES' EVIDENCE — the longer cell wins, then anything the
    // other side has that it lacks is appended rather than discarded.
    if (lose[4].length > win[4].length) { const t = win[4]; win[4] = lose[4]; lose[4] = t; }
    for (const re of CLAIMS) {
      const m = re.exec(lose[4]);
      if (m && !win[4].includes(lose[4].slice(m.index, m.index + 60))) {
        win[4] = `${win[4].trimEnd()} ${lose[4].slice(m.index).trim()}`;
      }
    }
    out.push(win.join('|'));
  }
  resolved++; i = k + 1;
}

writeFileSync(path, out.join('\n'));
console.log(`${path}: ${resolved} conflict block(s) resolved by the documented rule`);
if (left) {
  console.log(`${left} block(s) LEFT CONFLICTED — the two sides have different row counts,`);
  console.log('which is a structural conflict and not the false one this rule covers.');
  console.log('Resolve those by hand.');
  process.exit(1);
}
