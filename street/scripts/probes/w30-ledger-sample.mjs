// Item 66: draw a RANDOM sample of CONFIRMED ledger rows, reproducibly.
//
// Seeded and printed with its seed so the draw can be re-run and audited — a
// hand-picked "random" sample is the one way this audit could flatter itself,
// and the pass rate is the whole deliverable. Prints line number, owner and the
// request text (the claim), not the evidence cell: the item is explicit that
// rows are to be re-verified against the world as it is now, NOT against the
// evidence they cite.
//
// Usage: node scripts/probes/w30-ledger-sample.mjs [n] [seed]
import { readFileSync } from 'node:fs';

const n = +(process.argv[2] ?? 20);
const seed = +(process.argv[3] ?? 20260802);

// mulberry32 — small, seeded, and good enough for picking rows.
function rng(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lines = readFileSync('notes/LEDGER.md', 'utf8').split('\n');
const rows = [];
lines.forEach((l, i) => {
  if (!/^\| CONFIRMED \|/.test(l)) return;
  const cells = l.split('|').map((s) => s.trim());
  rows.push({ line: i + 1, owner: cells[2], request: cells[3] });
});
console.log(`${rows.length} CONFIRMED rows; drawing ${n} with seed ${seed}\n`);

const r = rng(seed);
const idx = rows.map((_, i) => i);
// Fisher-Yates on the index list, then take the first n — sampling WITHOUT
// replacement, so no row can be audited twice and count twice in the rate.
for (let i = idx.length - 1; i > 0; i--) {
  const j = Math.floor(r() * (i + 1));
  [idx[i], idx[j]] = [idx[j], idx[i]];
}
const pick = idx.slice(0, n).map((i) => rows[i]).sort((a, b) => a.line - b.line);
for (const p of pick) {
  console.log(`L${String(p.line).padStart(3)}  [${p.owner}]  ${p.request.slice(0, 150)}`);
}
