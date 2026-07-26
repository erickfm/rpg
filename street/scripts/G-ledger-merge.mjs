#!/usr/bin/env node
// RESOLVE A CONFLICTED notes/LEDGER.md WITHOUT LOSING ANYBODY'S VERDICT.
//
// The ledger is one line per row and every builder appends to the same cells, so
// a rebase conflicts on it almost every time. I resolved it by hand four times
// tonight and got it wrong once — I committed conflict markers, and on another
// pass a "keep the longer cell" heuristic would have DISCARDED another verifier's
// entire verdict, because their cell and mine each contained C's original plus
// only their own half. Neither was a superset of the other.
//
// THE RULE, in order:
//   1. if one cell CONTAINS the other, keep the container (nothing is lost)
//   2. otherwise MERGE: common prefix once, then both tails, so two independent
//      verdicts on one row both survive
//   3. the row's status is the MORE ADVANCED of the two (OPEN < LANDED <
//      CONFIRMED) — a rebase must never walk somebody's verdict backwards
//
// It prints what it did for every row and refuses to write if markers remain.
import { readFileSync, writeFileSync } from 'node:fs';
const P = process.argv[2] ?? 'notes/LEDGER.md';
const RANK = { OPEN: 0, LANDED: 1, CONFIRMED: 2 };
const cells = (r) => r.split('|');
const key = (r) => (cells(r)[3] ?? r).trim();
const rank = (r) => RANK[(cells(r)[1] ?? '').trim()] ?? 0;

const lines = readFileSync(P, 'utf8').split('\n');
const out = [];
let i = 0, merged = 0, kept = 0;
while (i < lines.length) {
  if (!lines[i].startsWith('<<<<<<<')) { out.push(lines[i++]); continue; }
  i++; const up = [];
  while (!lines[i].startsWith('=======')) up.push(lines[i++]);
  i++; const mine = [];
  while (!lines[i].startsWith('>>>>>>>')) mine.push(lines[i++]);
  i++;
  const upMap = new Map(up.map((r) => [key(r), r]));
  for (const r of mine) {
    const u = upMap.get(key(r));
    if (!u) { out.push(r); kept++; continue; }
    const uc = (cells(u)[4] ?? '').trim(), mc = (cells(r)[4] ?? '').trim();
    const top = rank(r) >= rank(u) ? cells(r)[1] : cells(u)[1];
    if (uc && uc === mc) { out.push(rank(r) >= rank(u) ? r : u); kept++; }
    else if (uc && mc.includes(uc)) { const f = cells(r); f[1] = top; out.push(f.join('|')); kept++; }
    else if (mc && uc.includes(mc)) { const f = cells(u); f[1] = top; out.push(f.join('|')); kept++; }
    else {
      let n = 0; while (n < Math.min(uc.length, mc.length) && uc[n] === mc[n]) n++;
      const f = cells(u); f[1] = top; f[4] = ` ${uc}${mc.slice(n)} `;
      out.push(f.join('|'));
      console.log(`  MERGED both verdicts   ${key(r).slice(0, 52)}`);
      merged++; continue;
    }
    console.log(`  kept the superset      ${key(r).slice(0, 52)}`);
  }
  const seen = new Set(mine.map(key));
  for (const r of up) if (!seen.has(key(r))) { out.push(r); kept++; console.log(`  upstream-only          ${key(r).slice(0, 52)}`); }
}
const text = out.join('\n');
if (/^(<<<<<<<|=======|>>>>>>>)/m.test(text)) {
  console.error('REFUSING TO WRITE: conflict markers remain'); process.exit(1);
}
writeFileSync(P, text);
console.log(`\n${merged} row(s) merged, ${kept} taken whole, 0 markers left.`);
