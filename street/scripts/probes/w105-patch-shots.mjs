// Item 191 — one-shot: wire `ensureShots()` into the four REGISTERED checks
// that do an `fs` write into `shots/` with no mkdir. Kept because the note that
// cites it is worth much less without it (BUILDER-BRIEF §7a), and because it
// records exactly which four and exactly where the call was placed.
import { readFileSync, writeFileSync } from 'node:fs';

const TARGETS = [
  ['scripts/masonry.mjs', "writeFileSync('shots/masonry.json'"],
  ['scripts/faces.mjs', "writeFileSync('shots/faces.png'"],
  ['scripts/seampairs.mjs', "writeFileSync('shots/seampairs.json'"],
  ['scripts/texdensity.mjs', "writeFileSync('shots/texdensity.json'"],
];
const IMPORT = "import { ensureShots } from './lib/shots.mjs';   // item 191: shots/ is gitignored";

for (const [f, anchor] of TARGETS) {
  let s = readFileSync(f, 'utf8');
  if (s.includes('ensureShots')) { console.log(`skip  ${f} — already wired`); continue; }
  const m = /^import \{[^}]*\} from 'node:fs';$/m.exec(s);
  if (!m) { console.log(`MISS  ${f} — no node:fs import line`); continue; }
  const end = m.index + m[0].length;
  s = `${s.slice(0, end)}\n${IMPORT}${s.slice(end)}`;
  const i = s.indexOf(anchor);
  if (i < 0) { console.log(`MISS  ${f} — write site moved`); continue; }
  const ls = s.lastIndexOf('\n', i) + 1;
  // IMMEDIATELY BEFORE THE WRITE, not at the top of the file. The directory
  // then exists at the moment it is needed even if an early `process.exit`
  // path is added above later, and the call sits where a reader asking "why is
  // this here" can see the write it protects.
  s = `${s.slice(0, ls)}ensureShots();\n${s.slice(ls)}`;
  writeFileSync(f, s);
  console.log(`ok    ${f}`);
}
