// Item 70, step 1: WHICH REGISTERED CHECKS HAVE A PROVEN FAILING PATH AT ALL?
//
// The item asks for every registered check to be made to fail and its exit
// status recorded. Before running anything, this asks the cheaper question the
// registry can already answer: how many rows even CLAIM a way to go red?
//
// The selftest column in scripts/checks.mjs is one of:
//   true          the script takes --selftest and breaks its own guarded thing
//   false         NO FAILING PATH DECLARED — nothing has ever watched it go red
//   ['case', …]   named mutation(s) in scripts/canfail.mjs
//
// It also reports which idiom each script uses to READ the flag, because
// scripts/checks-registered.mjs matches only the literal
// `argv.includes('--selftest')` and is blind to the shared
// `flags(['--selftest'])` helper — 34+ scripts, per notes/M-selftest-blindspot.md.
//
// No browser, no server. Usage: node scripts/probes/w32-failpath-inventory.mjs
import { readFileSync, existsSync } from 'node:fs';

const src = readFileSync('scripts/checks.mjs', 'utf8');
const body = src.slice(src.indexOf('const CHECKS = ['));

// One row per line: ['name', 'question', <selftest>, ...]
const rows = [];
for (const m of body.matchAll(/^\s*\['([a-zA-Z0-9._-]+)',\s*(.*)$/gm)) {
  const [, name, rest] = m;
  let selftest = 'unparsed';
  const after = rest.replace(/^(['"]).*?[^\\]\1\s*,\s*/, '');   // drop the question string
  if (/^true/.test(after)) selftest = 'true';
  else if (/^false/.test(after)) selftest = 'false';
  else if (/^\[/.test(after)) selftest = 'canfail ' + (after.match(/^\[([^\]]*)\]/)?.[1] ?? '');
  rows.push({ name, selftest });
}

const LIT = /argv\.includes\(\s*['"]--selftest['"]\s*\)/;
const HELPER = /flags\(\s*\[\s*['"]--selftest['"]/;
for (const r of rows) {
  const f = `scripts/${r.name}.mjs`;
  if (!existsSync(f)) { r.idiom = 'NO SUCH FILE'; continue; }
  const s = readFileSync(f, 'utf8');
  r.idiom = LIT.test(s) ? 'literal' : HELPER.test(s) ? 'flags() helper' : 'none';
  r.inverts = /SELFTEST PASSED|selftest passed/i.test(s);
}

const w = Math.max(...rows.map((r) => r.name.length));
for (const r of rows) {
  console.log(`  ${r.name.padEnd(w)}  selftest=${r.selftest.padEnd(16)} reads=${(r.idiom ?? '?').padEnd(14)} inverts=${r.inverts ? 'yes' : 'no'}`);
}

const none = rows.filter((r) => r.selftest === 'false');
const blind = rows.filter((r) => r.idiom === 'flags() helper');
const claims = rows.filter((r) => r.selftest === 'true' && r.idiom === 'none');
console.log(`\n  ${rows.length} registered checks`);
console.log(`  ${none.length} declare NO failing path (selftest=false): ${none.map((r) => r.name).join(', ')}`);
console.log(`\n  ${blind.length} read the flag via flags() — invisible to checks-registered.mjs's literal match`);
console.log(`\n  ${claims.length} are registered selftest=true but READ NO FLAG — the registry claims a`);
console.log(`  failing path the script cannot honour: ${claims.map((r) => r.name).join(', ') || '(none)'}`);
