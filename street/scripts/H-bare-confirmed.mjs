#!/usr/bin/env node
// Re-run the auditor's own sweep, which is the STATION their row names:
// "count CONFIRMED rows containing neither AUDITOR nor a verifier marker".
//
// The auditor has already corrected themselves once - their sweep matched
// `AUDITOR` CASE-SENSITIVELY and missed rows carrying "— auditor —" in lower
// case, giving 3 false positives out of 5 flagged, so the published 28 is an
// over-count of unknown size. This publishes the size.
//
// A row RESTS ON SOMETHING if its text contains any of:
//   auditor evidence   /auditor/i
//   a named verifier   /verifier|CONFIRMED by|VERIFIED by/i
//   a station          /CHECK FROM|WHERE TO STAND|STATION|PREDICATE/i
//   a desk ruling      /desk ruling|Desk 20|DESK RULING/i
// Stated explicitly so the definition can be argued with rather than guessed at.
import { readFileSync } from 'node:fs';
const ROW = /^\| CONFIRMED \|/;
// MY FIRST VERSION WAS KEYWORD PRESENCE AND IT RETURNED 0 OF 207, which is
// worthless: /STATION/i matches the word anywhere including prose ABOUT
// stations, and /auditor/i matches a passing mention. A row "rests on" a word
// it merely contains. So measure the EVIDENCE ITSELF - how much text is in the
// cells after the request - which is the auditor's own signal ("thirteen rest
// on under fifty characters").
const THIN = +(process.env.THIN ?? 120);
const rows = readFileSync('notes/LEDGER.md', 'utf8').split('\n').filter((l) => ROW.test(l));
const all = rows.map((l) => {
  const c = l.split('|');
  return { owner: c[2].trim(), req: c[3].trim(), ev: c.slice(4).join('|').trim() };
});
const bare = all.filter((r) => r.ev.length < THIN);
const buckets = [0, 10, 50, 120, 400, 1200, 1e9];
console.log(`${rows.length} CONFIRMED rows, by how much evidence the cell actually carries:`);
for (let i = 0; i + 1 < buckets.length; i++) {
  const n = all.filter((r) => r.ev.length >= buckets[i] && r.ev.length < buckets[i + 1]).length;
  const hi = buckets[i + 1] === 1e9 ? '+' : `..${buckets[i + 1] - 1}`;
  console.log(`   ${String(buckets[i]).padStart(5)}${hi.padEnd(7)} chars  ${String(n).padStart(3)}`);
}
console.log(`\nUNDER ${THIN} CHARS: ${bare.length}   (under 50: ${all.filter((r) => r.ev.length < 50).length}; the row published 28 bare and 13 under fifty)`);
const byOwner = {};
for (const b of bare) byOwner[b.owner] = (byOwner[b.owner] ?? 0) + 1;
console.log(`  by owner: ${JSON.stringify(byOwner)}`);
console.log('\nthinnest first:');
for (const b of bare.sort((a, c) => a.ev.length - c.ev.length)) {
  console.log(`  ${String(b.ev.length).padStart(5)} chars  ${b.owner.padEnd(6)} ${b.req.slice(0, 56)}`);
}
