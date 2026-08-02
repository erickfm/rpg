// IS notes/GOTCHAS.md NUMBERED CORRECTLY?  — QUEUE item 25.
//
// §51 and §52 were each used TWICE, and the second §51 sat AFTER the first §52.
// Nobody noticed for weeks, and the desk then appended "§59" by counting the
// last heading rather than the entries — so the file's own numbers had drifted
// two behind reality. Every citation written in that window points somewhere
// slightly wrong, and nothing in the repo could tell.
//
// This is the check that would have caught it on the first duplicate. It reads
// the headings and asserts they are 1..N: unique, monotonic, contiguous, and
// each one actually titled — the untitled `## 59.` is how the third defect hid.
//
// Exit 0 = well-formed. Exit 1 = not.
//
//   node scripts/probes/gotchas-numbering.mjs
//
// No browser and no world: this is a fact about a text file, so it runs in
// milliseconds and could be wired into a pre-commit hook cheaply.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(new URL('../../notes/GOTCHAS.md', import.meta.url));
const lines = readFileSync(FILE, 'utf8').split('\n');

// `## <n>. <title>` — the entry headings. The file also uses `## ` for prose
// sections (the renumbering note at the top), so a heading only counts as an
// entry when it starts with a number and a dot.
const entries = [];
lines.forEach((text, i) => {
  const m = /^## (\d+)\.(.*)$/.exec(text);
  if (m) entries.push({ n: +m[1], title: m[2].trim(), line: i + 1 });
});

const fail = [];

// 1. unique
const seen = new Map();
for (const e of entries) {
  if (seen.has(e.n)) fail.push(`§${e.n} is used twice — lines ${seen.get(e.n)} and ${e.line}`);
  else seen.set(e.n, e.line);
}

// 2. monotonic
for (let i = 1; i < entries.length; i++)
  if (entries[i].n <= entries[i - 1].n)
    fail.push(`out of order: §${entries[i].n} (line ${entries[i].line}) follows §${entries[i - 1].n}`);

// 3. contiguous from 1 — a gap means an entry was deleted without renumbering,
//    which breaks citations exactly as a duplicate does
const nums = entries.map((e) => e.n);
for (let want = 1; want <= Math.max(...nums); want++)
  if (!seen.has(want)) fail.push(`§${want} is missing — the sequence has a hole`);

// 4. titled. `## 59.` with no title is why nobody could see it was wrong.
for (const e of entries)
  if (!e.title) fail.push(`§${e.n} (line ${e.line}) has no title`);

console.log(`${entries.length} entries, §${Math.min(...nums)}–§${Math.max(...nums)}`);
if (fail.length) {
  console.log(`\n${fail.length} problem(s):`);
  for (const f of fail) console.log(`   FAIL  ${f}`);
} else {
  console.log('unique, monotonic, contiguous from 1, every entry titled');
}
process.exit(fail.length ? 1 : 0);
