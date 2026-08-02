// ONE JOB, run once: route every hardcoded default port in scripts/ through
// scripts/lib/aim.mjs, so an unaimed instrument says so instead of measuring
// whatever is on the port.
//
// Kept (in probes/, per BUILDER-BRIEF §7a) rather than thrown away, because the
// sweep it performed is 600-odd files and the next person to ask "was this
// applied uniformly, or by hand?" deserves the answer.
//
//   node scripts/probes/w19-aim-codemod.mjs --dry     count, change nothing
//   node scripts/probes/w19-aim-codemod.mjs           apply
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';

const DRY = process.argv.includes('--dry');
const ROOT = 'scripts';
// The one expression this replaces, in every spacing and both operators seen in
// the tree: ?? and ||, with or without spaces around them.
const DEFAULT_RE = /process\.env\.SHOT_URL\s*(?:\?\?|\|\|)\s*'(https?:\/\/[^']+)'/g;

const files = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = `${d}/${e}`;
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (/\.(mjs|js)$/.test(e)) files.push(p);
  }
})(ROOT);

const changed = [], skipped = [];
for (const f of files) {
  // never rewrite the helper itself, or this codemod
  if (f.endsWith('/lib/aim.mjs') || f.includes('w19-aim-codemod')) continue;
  const src = readFileSync(f, 'utf8');
  if (!DEFAULT_RE.test(src)) { DEFAULT_RE.lastIndex = 0; continue; }
  DEFAULT_RE.lastIndex = 0;

  const body = src.replace(DEFAULT_RE, (_m, url) => `aim('${url}')`);

  // Where does lib/ sit from here? scripts/x.mjs -> ./lib, scripts/probes/x.mjs -> ../lib
  const depth = f.split('/').length - 2;          // 0 for scripts/x.mjs
  const rel = `${'../'.repeat(depth) || './'}lib/aim.mjs`;

  // Insert before the FIRST import. ESM imports hoist, so position among them
  // does not matter, and going before the first one keeps us out of any
  // trailing block of destructuring or top-level await that follows them.
  const firstImport = body.search(/^import\s/m);
  if (firstImport === -1) { skipped.push([f, 'no import statement to anchor to']); continue; }
  if (body.includes(`from '${rel}'`)) { skipped.push([f, 'already imports aim']); continue; }
  const out = body.slice(0, firstImport)
    + `import { aim } from '${rel}';\n`
    + body.slice(firstImport);

  changed.push(f);
  if (!DRY) writeFileSync(f, out);
}

console.log(`${files.length} script(s) scanned`);
console.log(`${changed.length} ${DRY ? 'would be' : ''} rewritten to use aim()`);
if (skipped.length) {
  console.log(`\n${skipped.length} skipped:`);
  for (const [f, why] of skipped) console.log(`  ${f}  — ${why}`);
}
