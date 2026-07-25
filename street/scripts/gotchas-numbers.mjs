// Are the GOTCHAS numbered uniquely and in order?
//
// Three times now two builders have appended an entry with the same number on
// the same day — 22/23, 27/28, and 28/29. Each time it was caught by somebody
// happening to look, and each time the cost is real: §22 is cited nine times
// from ct/props.ts and scripts/nightgrade.mjs, including in that script's own
// pass/fail line, so a reader following the number lands on the wrong entry.
//
// A shared, hand-allocated sequence with no allocator will collide forever.
// This is the allocator: a duplicate or an out-of-order heading fails, and the
// convention when it does is that the LATER commit renumbers, because any
// reference that already exists points at the earlier entry.
//
// Reads the file. No browser, no world.
//
// Usage: node scripts/gotchas-numbers.mjs
//        --selftest   duplicate a number in memory, require this to fail
import { readFileSync } from 'node:fs';

const SELFTEST = process.argv.includes('--selftest');
const FILE = 'notes/GOTCHAS.md';
const nums = [];
for (const line of readFileSync(FILE, 'utf8').split('\n')) {
  const m = line.match(/^##\s+(\d+)\.\s+(.*)$/);
  if (m) nums.push({ n: +m[1], title: m[2].trim() });
}
if (SELFTEST && nums.length) nums.push({ n: nums[nums.length - 1].n, title: '(selftest duplicate)' });

console.log(`${FILE}: ${nums.length} numbered entries, 1 … ${nums.length ? nums[nums.length - 1].n : 0}`);
const fail = [];
// An EMPTY list is trivially unique and trivially ordered. If the file moves,
// is renamed, or its heading style changes, `nums` goes to zero and every
// assertion below passes by having nothing to disagree about. GOTCHAS has
// thirty-plus entries; zero means the parse broke, not that the file is clean.
if (!nums.length) {
  console.error(`\nNO NUMBERED ENTRIES FOUND IN ${FILE}.`);
  console.error('  Uniqueness and ordering are vacuous on an empty list, so this is a');
  console.error('  parse failure rather than a pass — check the heading format.');
  process.exit(1);
}
const seen = new Map();
for (const e of nums) {
  if (seen.has(e.n)) fail.push(`§${e.n} used twice: "${seen.get(e.n)}" and "${e.title}"`);
  else seen.set(e.n, e.title);
}
for (let i = 1; i < nums.length; i++) {
  if (nums[i].n < nums[i - 1].n) fail.push(`§${nums[i].n} appears after §${nums[i - 1].n} — out of order`);
}
if (fail.length) {
  console.error(`\nFAILED (${fail.length}):`);
  for (const f of fail) console.error(`  ${f}`);
  console.error(`\nThe LATER commit renumbers: existing references point at the earlier entry.`);
  if (SELFTEST) { console.log('SELFTEST PASSED — the duplicate was caught'); process.exit(0); }
  process.exit(1);
}
if (SELFTEST) { console.error('\nSELFTEST FAILED — a duplicate number was added and this did not notice.'); process.exit(2); }
console.log('every number is unique and in order.');
