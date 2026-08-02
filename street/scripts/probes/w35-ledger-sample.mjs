// w35 — draw a REPRODUCIBLE random sample of CONFIRMED ledger rows.
// The point of item 66 is that the sample be random, not hand-picked (BUILDER-BRIEF §7:
// "hand-picked cases test your mental model, not the code"). So the RNG is seeded and
// printed: anyone can re-run this and get the same 20 rows.
import { readFileSync } from 'node:fs';

const SEED = Number(process.argv[2] ?? 20260802);
const N = Number(process.argv[3] ?? 20);
const LEDGER = new URL('../../notes/LEDGER.md', import.meta.url);

// mulberry32 — small, deterministic, and written here rather than imported so the
// sample can be reproduced from this file alone.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lines = readFileSync(LEDGER, 'utf8').split('\n');
const rows = [];
lines.forEach((line, i) => {
  if (!line.startsWith('| CONFIRMED |')) return;
  const cells = line.split('|').map((c) => c.trim());
  // cells: ['', STATUS, owner, request, evidence..., '']
  rows.push({
    line: i + 1,
    owner: cells[2],
    request: cells[3],
    evidenceLen: line.length - cells.slice(0, 4).join('|').length,
  });
});

const rnd = mulberry32(SEED);
// Fisher-Yates over the index list, then take the first N.
const idx = rows.map((_, i) => i);
for (let i = idx.length - 1; i > 0; i--) {
  const j = Math.floor(rnd() * (i + 1));
  [idx[i], idx[j]] = [idx[j], idx[i]];
}
const sample = idx.slice(0, N).sort((a, b) => a - b);

console.log(`CONFIRMED rows in ledger: ${rows.length}`);
console.log(`seed ${SEED}, sample size ${N}\n`);
for (const i of sample) {
  const r = rows[i];
  console.log(`#${String(i).padStart(3)} L${String(r.line).padStart(3)} [${r.owner}] ${r.request.slice(0, 150)}`);
}
