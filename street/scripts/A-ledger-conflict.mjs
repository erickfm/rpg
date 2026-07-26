// RESOLVE A LEDGER.md CONFLICT WITHOUT LOSING EITHER SIDE'S EVIDENCE.
//
// Ten writers, one file, and every rebase during a verification pass collides:
// upstream lands somebody's evidence into a row while I am appending mine to
// the same row. Hand-resolving that is fine once and dangerous five times —
// the failure mode is silently dropping the other side's cell, which is
// somebody's whole afternoon, and nobody would notice until they looked.
//
// So this is mechanical and conservative:
//
//   · rows are matched by their REQUEST text (column 3), not by line position,
//     because both sides reflow and reorder around each other;
//   · the evidence cell is upstream's, with any trailing chunk that exists only
//     on my side APPENDED — so two verifiers writing the same row both survive;
//   · the status is whichever is further along, OPEN < LANDED < CONFIRMED,
//     because a confirmation is never undone by a rebase;
//   · a row on only one side is kept as-is;
//   · anything it cannot match, it leaves conflicted and says so, rather than
//     guessing. A resolver that silently drops a row is worse than a conflict.
//
// It never re-sorts and never reflows — the desk's standing rule, and the
// reason a whitespace change here conflicts with every concurrent edit.
//
//   node scripts/A-ledger-conflict.mjs            # resolve notes/LEDGER.md
//   node scripts/A-ledger-conflict.mjs --dry      # show what it would do
import { readFileSync, writeFileSync } from 'node:fs';

const DRY = process.argv.includes('--dry');
const BAD = process.argv.slice(2).filter((a) => a !== '--dry');
if (BAD.length) {
  console.error(`\n  CANNOT USE THESE ARGUMENTS: ${BAD.join(' ')}. Nothing was changed.`);
  console.error('  give nothing, or --dry\n');
  process.exit(2);
}

const FILE = 'notes/LEDGER.md';
const RANK = { OPEN: 0, LANDED: 1, CONFIRMED: 2 };
const lines = readFileSync(FILE, 'utf8').split('\n');

const cells = (row) => row.split('|');
const key = (row) => (cells(row)[3] ?? '').trim();           // the user's request text
const status = (row) => (cells(row)[1] ?? '').trim();
const evidence = (row) => {
  const c = cells(row);
  return c.slice(4).join('|').replace(/\s*\|\s*$/, '');
};
const rebuild = (row, st, ev) => {
  const c = cells(row);
  return `| ${st} |${c[2]}|${c[3]}| ${ev.trim()} |`;
};

// Merge one upstream row with one of mine: better status, and my evidence
// appended if it says something upstream's does not.
function merge(head, mine) {
  const st = RANK[status(head)] >= RANK[status(mine)] ? status(head) : status(mine);
  const a = evidence(head).trim(), b = evidence(mine).trim();
  if (!b || a.includes(b)) return rebuild(head, st, a);
  if (!a || b.includes(a)) return rebuild(head, st, b);
  // the divergent tail: the longest suffix of mine that upstream lacks
  let cut = 0;
  for (let i = 0; i < b.length; i++) {
    if (a.includes(b.slice(0, i + 1))) cut = i + 1; else break;
  }
  const tail = b.slice(cut).trim();
  return rebuild(head, st, tail ? `${a} ${tail}` : a);
}

let out = [], i = 0, resolved = 0, kept = 0, stuck = 0;
while (i < lines.length) {
  if (!lines[i].startsWith('<<<<<<<')) { out.push(lines[i++]); continue; }
  const s = i;
  const m = lines.findIndex((l, j) => j > s && l === '=======');
  const e = lines.findIndex((l, j) => j > m && l.startsWith('>>>>>>>'));
  if (m < 0 || e < 0) { out.push(lines[i++]); continue; }
  const head = lines.slice(s + 1, m).filter((l) => l.trim());
  const mine = lines.slice(m + 1, e).filter((l) => l.trim());
  const byKey = new Map();
  const order = [];
  for (const r of head) { const k = key(r); if (!byKey.has(k)) order.push(k); byKey.set(k, { head: r }); }
  for (const r of mine) {
    const k = key(r);
    if (!byKey.has(k)) { byKey.set(k, { mine: r }); order.push(k); }
    else byKey.get(k).mine = r;
  }
  const rows = [];
  for (const k of order) {
    const { head: h, mine: n } = byKey.get(k);
    if (h && n) { rows.push(merge(h, n)); resolved++; }
    else { rows.push(h ?? n); kept++; }
  }
  // only take it if every line is still a table row — never emit half a table
  if (rows.every((r) => r.startsWith('|') && r.split('|').length >= 5)) out.push(...rows);
  else { out.push(...lines.slice(s, e + 1)); stuck++; }
  i = e + 1;
}

console.log(`\n  merged rows (both sides had them): ${resolved}`);
console.log(`  kept as-is (one side only):        ${kept}`);
console.log(`  left conflicted (not understood):  ${stuck}`);
if (DRY) { console.log('\n  --dry: nothing written.\n'); process.exit(stuck ? 1 : 0); }
writeFileSync(FILE, out.join('\n'));
if (stuck) {
  console.error(`\n  ${stuck} hunk(s) left for you — resolve those by hand.\n`);
  process.exit(1);
}
console.log(`\n  ${FILE} resolved. Check it, then: git add ${FILE} && git rebase --continue\n`);
