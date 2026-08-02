// DOES EVERY canfail CASE STILL AIM AT SOMETHING?
//
// canfail.mjs already refuses to trust a mutation that patched nothing — line
// ~805 scores `NEEDLE  matched 0x, not 1` and line ~868 counts anything that is
// not CAUGHT as bad, so the harness exits non-zero. The class is closed.
//
// What it cannot do is tell you BEFORE a full run, and a full run is a build
// plus a browser per case. The rain needle was stale from fc332c5c5 until
// 2026-08-02 and nobody paid the minutes to find out. This reads the CASES
// table straight out of the source and greps each needle against the file it
// targets — no build, no browser, about a second.
//
// Usage: node scripts/probes/w18-canfail-needle-audit.mjs
import { readFileSync } from 'node:fs';

const SRC = readFileSync('scripts/canfail.mjs', 'utf8');

// the file-constant table at the top of canfail.mjs, read rather than retyped
const FILES = {};
for (const m of SRC.matchAll(/^const ([A-Z][A-Z0-9_]*) = '([^']+\.ts)';/gm)) FILES[m[1]] = m[2];

const block = SRC.match(/^const CASES = \[[\s\S]*?\n\];/m);
if (!block) { console.error('could not find the CASES table'); process.exit(3); }

// Each case opens with:  ['name', FILECONST,\n 'needle',\n 'repl',
const cases = [...block[0].matchAll(
  /\[\s*'([^']+)'\s*,\s*([A-Z][A-Z0-9_]*)\s*,\s*\n\s*('(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)\s*,/g)];

console.log(`${cases.length} cases with a quotable needle\n`);
const cache = {};
let bad = 0;
for (const [, name, fileConst, rawNeedle] of cases) {
  const file = FILES[fileConst];
  if (!file) { console.log(`????  ${name.padEnd(22)} unknown file constant ${fileConst}`); bad++; continue; }
  cache[file] ??= readFileSync(file, 'utf8');
  // Unquote exactly the way JS would — INCLUDING \n.
  //
  // The first cut wrapped the raw inner text in JSON.stringify, which escapes
  // the backslash, so a needle containing \n came back as the two characters
  // backslash-n instead of a newline and every multi-line case reported 0x.
  // That produced one false FAIL (park-partial) on its first run. Going
  // through a JSON *string literal* instead lets JSON.parse expand \n, \t and
  // \\ the way the JS parser does.
  const inner = rawNeedle.slice(1, -1);
  const needle = rawNeedle[0] === '`'
    ? inner.replace(/\\`/g, '`')
    : JSON.parse('"' + inner.replace(/"/g, '\\"').replace(/\\'/g, "'") + '"');
  const n = cache[file].split(needle).length - 1;
  const ok = n === 1;
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${name.padEnd(22)} ${String(n)}x in ${file}`);
  if (!ok) console.log(`        needle: ${needle.slice(0, 90)}`);
}
console.log(bad ? `\n${bad} case(s) aim at nothing (or at more than one place) — they cannot mutate` : '\nevery case still aims at exactly one place');
process.exit(bad ? 1 : 0);
