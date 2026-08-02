// DO THE LEDGER'S INTERIOR CITATIONS STILL NAME THE ROOM THEY MEANT?
//
// Two rooms were inserted into the interior belt — a bank at 440 and a jail at
// 1000 — and every room after each insertion slid +80 m. The measurements in
// those rows are not wrong; their ADDRESSES are. A cell reading "standing in the
// casino at (600, 0)" was true when written and now sends a reader into the
// burger barn.
//
// That is worse than the 28 rows resting on nothing, because these rows LOOK
// evidenced: they name a room, a coordinate and a station, and every part of
// that reads as careful work. Only the arithmetic has rotted underneath.
//
// THE BELT IS READ FROM THE WORLD, never typed. `__ct.roomDims()` is the
// authority; a hand-copied belt in this file would be the same class of bug one
// layer up, and this project has been bitten by exactly that (two scripts once
// carried hand-copies of the rain formula and drifted).
//
// THE DELTAS ARE DERIVED, not guessed: a room that now sits after the bank moved
// +80, and one that also sits after the jail moved +160. Confirmed against the
// auditor's own examples — casino cited at 600 is now 680, church keeper cited
// at 676.6 is now 756.6, hotel cited at 834.84 is now 914.84, library cited at
// 920 is now 1080.
//
//   node scripts/A-citations-point-somewhere.mjs          # report
//   node scripts/A-citations-point-somewhere.mjs --fix    # re-point the numbers
//
// --fix rewrites ONLY the digits of a stale coordinate, never the sentence
// around it, and refuses to write if the row count changes. Given this file has
// lost eight rows today to bulk edits, a tool that touches it has to prove it
// took nothing away.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

// --fix WAS BUILT AND THEN REMOVED, and the reason is the finding.
//
// Rewriting the numbers in place looked obviously right and would have corrupted
// three kinds of correct text:
//
//   QUOTATIONS       a cell quoting *"the casino floor at x 598-601"* — editing
//                    inside quotation marks falsifies what somebody said.
//   DRIFT RECORDS    rows that already EXPLAIN the slide and carry the mapping
//                    (`bodega 440→520, burger 520→600, …`). Rewriting those
//                    turns a correct history into a false one; one reads "the
//                    library was at cx 920 THEN", which is exactly right and
//                    which --fix would have made a lie.
//   NOT COORDINATES  `library 440 m²` is an area; `(build 7a2b6f479)` is a sha;
//                    `600 ms` is a timing.
//
// Most hits are the second kind — the rows doing the best work are the ones an
// automatic fixer damages worst. So this REPORTS, and a human re-points the
// handful of real stations by APPENDING today's address rather than editing
// yesterday's. The record keeps what was measured; the reader gets somewhere to
// stand.
const FIX = false;
const BAD = process.argv.slice(2);
if (BAD.length) {
  console.error(`\n  CANNOT USE THESE ARGUMENTS: ${BAD.join(' ')}. Nothing was read.`);
  console.error('  give nothing — this reports and never writes\n');
  process.exit(2);
}

const URL = aim('http://localhost:4188/');
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(2500);
const belt = await p.evaluate(() => window.__ct.roomDims()
  .map((q) => ({ id: q.id, cx: q.cx, w: q.w })).sort((a, c) => a.cx - c.cx));
await b.close();

if (belt.length < 4) {
  console.error('\nCANNOT ANSWER — the world published no room belt; nothing was checked.\n');
  process.exit(3);                                        // GOTCHAS 32/34
}

// Which rooms were inserted, and therefore how far everything after them slid.
const INSERTED = ['bank', 'jail'];
const delta = (id) => {
  const me = belt.find((r) => r.id === id);
  if (!me || INSERTED.includes(id)) return 0;
  return INSERTED.filter((n) => {
    const ins = belt.find((r) => r.id === n);
    return ins && ins.cx < me.cx;
  }).length * 80;
};
const roomAt = (x) => belt.find((r) => x >= r.cx - r.w / 2 - 2 && x <= r.cx + r.w / 2 + 2) ?? null;
const inRoom = (id, x) => { const r = belt.find((q) => q.id === id); return r && Math.abs(x - r.cx) <= r.w / 2 + 2; };

const NAMES = belt.map((r) => r.id);
const lines = readFileSync('notes/LEDGER.md', 'utf8').split('\n');
const before = lines.filter((l) => /^\|\s*(OPEN|LANDED|CONFIRMED)\s*\|/i.test(l)).length;

const hits = [];
lines.forEach((line, i) => {
  if (!/^\|\s*(LANDED|CONFIRMED)\s*\|/i.test(line)) return;
  // every number that could be an interior x, with where it sits in the line
  for (const m of line.matchAll(/(?<![\d.])(\d{3,4}(?:\.\d+)?)(?![\d.])/g)) {
    const x = parseFloat(m[1]);
    if (x < 400 || x > 1400) continue;
    // WHAT A NUMBER IS, NOT JUST WHAT IT LOOKS LIKE. My first pass rewrote
    // anything 400-1400 near a room name and would have corrupted three kinds
    // of text that are not coordinates at all:
    //   `(build 7a2b6f479)`   digits inside a commit sha
    //   `600 ms`, `1200 ms`   timings
    //   counts, widths, sizes generally
    // A tool that edits the ledger has to be certain what it is editing, so a
    // number now has to LOOK LIKE AN ADDRESS: sitting in a hex token disquali-
    // fies it, a unit immediately after disqualifies it, and it must be
    // introduced the way a coordinate is — `x 600`, `(600, 0)`, `at 600`.
    const around = line.slice(Math.max(0, m.index - 12), m.index + m[1].length + 6);
    if (/[0-9a-f]{6,}/i.test(around.replace(m[1], '')) && /build|sha|commit|`[0-9a-f]/i.test(around)) continue;
    const after = line.slice(m.index + m[1].length, m.index + m[1].length + 6);
    if (/^\s*(ms|s\b|px|%|°|m\b(?!\s*[,)]))/.test(after)) continue;
    const lead = line.slice(Math.max(0, m.index - 6), m.index);
    if (!/(x\s*=?\s*|\(\s*|at\s+|,\s*)$/i.test(lead)) continue;
    // the room named nearest this number, within a sentence's reach
    const win = line.slice(Math.max(0, m.index - 90), m.index + 90).toLowerCase();
    const named = NAMES.filter((n) => win.includes(n));
    if (named.length !== 1) continue;              // ambiguous or unnamed — say nothing
    const id = named[0];
    if (inRoom(id, x)) continue;                   // already points where it says
    const d = delta(id);
    const moved = x + d;
    hits.push({ row: i, id, x, moved, nowIn: roomAt(x)?.id ?? '(nothing)',
                recovers: d > 0 && inRoom(id, moved), idx: m.index, raw: m[1] });
  }
});

console.log(`\nbelt read from the world: ${belt.map((r) => `${r.id}@${r.cx}`).join(' ')}`);
console.log(`inserted since: ${INSERTED.join(', ')} — everything after each slid +80\n`);
console.log(`${hits.length} citation(s) whose coordinate no longer names the room beside it\n`);
for (const h of hits) {
  console.log(`  line ${String(h.row + 1).padStart(4)}  says "${h.id}" at ${h.x}` +
    `  — ${h.x} is now ${h.nowIn}` +
    (h.recovers ? `  → re-points to ${h.moved}` : `  → NOT RECOVERABLE by the +${delta(h.id)} slide`));
}
const stuck = hits.filter((h) => !h.recovers);
console.log(`\nrecoverable by the known slide: ${hits.length - stuck.length}   not recoverable: ${stuck.length}`);

if (!FIX) {
  console.log(`\nREPORT ONLY — this never writes. Re-point a real station by APPENDING`);
  console.log(`today's address; do not edit yesterday's, and check first whether the row`);
  console.log(`is a quotation or already explains the slide.\n`);
  process.exit(hits.length ? 1 : 0);
}

// Rewrite right-to-left so earlier indices stay valid, and only the digits.
const byRow = new Map();
for (const h of hits) { if (h.recovers) (byRow.get(h.row) ?? byRow.set(h.row, []).get(h.row)).push(h); }
let changed = 0;
for (const [row, hs] of byRow) {
  let l = lines[row];
  for (const h of hs.sort((a, c) => c.idx - a.idx)) {
    l = l.slice(0, h.idx) + String(h.moved) + l.slice(h.idx + h.raw.length);
    changed++;
  }
  lines[row] = l;
}
const after = lines.filter((l) => /^\|\s*(OPEN|LANDED|CONFIRMED)\s*\|/i.test(l)).length;
if (after !== before) {
  console.error(`\nREFUSING TO WRITE — row count changed ${before} → ${after}. Nothing saved.`);
  process.exit(1);
}
writeFileSync('notes/LEDGER.md', lines.join('\n'));
console.log(`\nre-pointed ${changed} coordinate(s); rows unchanged at ${after}.`);
if (stuck.length) console.log(`${stuck.length} left for a human — the slide does not explain them.`);
