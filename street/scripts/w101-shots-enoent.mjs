// ITEM 260 (4/4) — WHICH SCRIPTS STILL DIE ON A MISSING `shots/`?
//
// `shots/` is gitignored, so a FRESH WORKTREE does not have it. `ghosts.mjs`
// wrote its verdict there with `writeFileSync` and no `mkdirSync`, so on a new
// checkout it threw ENOENT **after printing its verdict** — a missing directory
// reported to the suite as a corridor defect. That is item 191's exact shape:
// an instrument's own environment failing, dressed as a finding about the world.
//
// It is fixed in `ghosts.mjs`. The item asks the obvious next question: **is
// anything else like that?** This answers it statically, over every script,
// rather than by running 800 of them.
//
// A script is at risk when it writes into `shots/` and never creates it.
// `page.screenshot({ path })` has the SAME failure — Playwright does create
// intermediate directories for `path`, but only for the screenshot; a sibling
// `writeFileSync` in the same script does not benefit, and a script that only
// screenshots is safe. So the two are reported separately rather than lumped.
//
// Usage: node scripts/probes/w101-shots-enoent.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['scripts', 'scripts/probes', 'scripts/lib'];
const files = [];
for (const r of roots) {
  let ents = [];
  try { ents = readdirSync(r); } catch { continue; }
  for (const f of ents) {
    const p = join(r, f);
    if (statSync(p).isFile() && /\.mjs$/.test(f)) files.push(p);
  }
}
if (files.length < 200) {
  console.error(`only ${files.length} scripts found — this scan has misparsed the tree, not`
    + ' discovered a small one. Refusing to report a clean bill of health.');
  process.exit(2);
}

// node's own fs writes: these throw ENOENT if the directory is absent.
const NODE_WRITE = /\b(writeFileSync|createWriteStream|appendFileSync|cpSync|renameSync|copyFileSync)\s*\(\s*[`'"]shots\//;
// playwright creates parents for `path`, so this alone is not a fault
const PW_SHOT = /path:\s*[`'"]shots\//;
// ⚠ TWO WAYS TO BE GUARDED, AND THE SECOND ONE ALMOST MADE THIS SCRIPT LIE.
// Item 191 fixed the four registered checks by importing `ensureShots()` from
// `scripts/lib/shots.mjs` rather than by writing `mkdirSync('shots'…)` in each
// file — one authored place instead of four copies. This scan only knew the
// literal spelling, so it went on reporting all four as AT RISK after they were
// fixed, and would have sat there red for good.
//
// **A scan that only recognises one spelling of the fix reports the fix as the
// bug.** It matches the CALL, not the import, so a file that imports the helper
// and never calls it is still correctly flagged.
const MKDIR = /mkdirSync\s*\(\s*[`'"]shots|\bensureShots\s*\(/;

/** The whole judgement, as a pure function of one file's text — so `--selftest`
 *  can exercise it on strings instead of on the tree. Returns 'risky',
 *  'shot-only', or null. */
export function classify(s) {
  if (!/[`'"]shots\//.test(s)) return null;
  const guarded = MKDIR.test(s);
  if (NODE_WRITE.test(s) && !guarded) return 'risky';
  if (PW_SHOT.test(s) && !guarded) return 'shot-only';
  return null;
}

// ── --selftest: CAN THIS VERDICT GO RED? ────────────────────────────────────
//
// ITEM 191. Registering a check with no declared failing path is the exact
// complaint item 260 was raised about, so this one arrives with its own. It
// runs against LITERAL STRINGS rather than against the tree, for two reasons:
// the judgement is a pure function of file text, and the alternative — writing
// a deliberately-broken script into `scripts/` and deleting it again — puts a
// booby-trapped file in a directory other builders are reading.
//
// **BOTH SIGNS, and the ones that would actually drift.** The third case is the
// one that matters most: it is the fix as it is really written now, through the
// shared helper, and it is what caught this scan reporting the four repaired
// checks as still broken.
if (process.argv.includes('--selftest')) {
  const cases = [
    ["writeFileSync('shots/x.json', '1');", 'risky', 'an unguarded fs write is caught'],
    ["mkdirSync('shots', {recursive:true});\nwriteFileSync('shots/x.json','1');", null,
      'the literal mkdir spelling is accepted'],
    ["import { ensureShots } from './lib/shots.mjs';\nensureShots();\nwriteFileSync('shots/x.json','1');",
      null, 'the shared-helper spelling is accepted (the drift this scan already had)'],
    ["import { ensureShots } from './lib/shots.mjs';\nwriteFileSync('shots/x.json','1');", 'risky',
      'importing the helper without CALLING it is still caught'],
    ["await page.screenshot({ path: 'shots/x.png' });", 'shot-only',
      'a screenshot is not a fault — playwright makes the directory'],
    ["writeFileSync('notes/x.json', '1');", null, 'a write to a TRACKED dir is not this bug'],
  ];
  let bad = 0;
  for (const [src, want, why] of cases) {
    const got = classify(src);
    const ok = got === want;
    if (!ok) bad++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${why}  (want ${want}, got ${got})`);
  }
  console.log(bad ? `\nSELFTEST FAILED — ${bad} of ${cases.length}` : `\nselftest: ${cases.length}/${cases.length}`);
  process.exit(bad ? 2 : 0);
}

const risky = [], shotOnly = [];
for (const p of files) {
  const verdict = classify(readFileSync(p, 'utf8'));
  if (verdict === 'risky') risky.push(p);
  else if (verdict === 'shot-only') shotOnly.push(p);
}

// WHICH OF THEM ARE REGISTERED CHECKS — that is the actionable half. A one-shot
// probe that throws on a fresh worktree costs the person running it a minute; a
// REGISTERED check that throws is a false red in `npm run checks`, on a machine
// where nobody has taken a screenshot yet, blamed on the world.
let registered = new Set();
try {
  const cs = readFileSync('scripts/checks.mjs', 'utf8');
  registered = new Set([...cs.slice(cs.indexOf('const CHECKS = ['))
    .matchAll(/\[\s*'([a-zA-Z0-9._-]+)'\s*,/g)].map((m) => m[1]));
} catch { /* reported below as unknown */ }
const isCheck = (p) => registered.has(p.replace(/^scripts\//, '').replace(/\.mjs$/, ''));

console.log(`${files.length} scripts scanned; ${registered.size} names in the CHECKS registry\n`);
const riskyChecks = risky.filter(isCheck);
console.log(`AT RISK AND REGISTERED — these can go red in `
  + `\`npm run checks\` on a fresh worktree: ${riskyChecks.length}`);
for (const p of riskyChecks) console.log(`  ${p}   <-- FIX THESE`);
console.log(`\nAT RISK — a node fs write into shots/ with no mkdirSync: ${risky.length}`);
for (const p of risky) console.log(`  ${p}${isCheck(p) ? '   (REGISTERED)' : ''}`);
console.log(`\nscreenshot-only, no mkdirSync: ${shotOnly.length}`);
console.log('  (playwright creates parent dirs for `path`, so these are NOT a fault —');
console.log('   listed so the next reader does not have to re-derive that.)');
for (const p of shotOnly.slice(0, 12)) console.log(`  ${p}`);
if (shotOnly.length > 12) console.log(`  …and ${shotOnly.length - 12} more`);
// ── POPULATION FLOOR, BEFORE ANY VERDICT ────────────────────────────────────
//
// ITEM 191, and it is the reason this is safe to register. Every number above
// is a FILTER over two populations, and both can collapse silently:
//
//   files       the scripts on disk. A bad glob and this walks zero of them.
//   registered  the names parsed out of `checks.mjs`. **This is the dangerous
//               one**: `isCheck` is a lookup into that Set, so if the parse
//               breaks — someone renames `const CHECKS`, the regex drifts — the
//               Set is EMPTY, `isCheck` returns false for everything,
//               `riskyChecks` is 0, and this exits **green having decided that
//               no check in the project is registered.** That is a guard that
//               reports the best possible news at the exact moment it stops
//               working, which is the family this whole item belongs to.
//
// Set well under the real figures (1269 files, 149 names) and far over the
// collapse they catch. Exit 2, not 1: the instrument failed, not the world.
if (files.length < 500 || registered.size < 100) {
  console.error(`\nTHIS CHECK MEASURED (ALMOST) NOTHING: ${files.length} scripts scanned`
    + ` (floor 500), ${registered.size} registered names parsed (floor 100).`);
  console.error('  "0 registered checks at risk" is free at zero and is not a pass — with an');
  console.error('  empty registry every script looks unregistered. Fix the scan, not the tree.');
  process.exit(2);
}

// ⚠ THE VERDICT IS THE **REGISTERED** SUBSET, NOT ALL 51, AND THAT IS NOT A
// LOOSENING. This file's own headline question is "can `npm run checks` go red
// on a fresh worktree" — that is what the registered subset answers, and
// `checks.mjs` now calls `ensureShots()` at suite start as well, so nothing the
// SUITE runs can hit this. The other ~51 are one-shot probes nobody has run
// twice; gating on them would make this permanently red, clearable only by
// editing fifty-one files nobody named, and a check that cries wolf gets
// ignored — which is how the four registered ones survived so long. **The count
// is still printed above**, so the information is not lost, only the veto.
process.exit(riskyChecks.length ? 1 : 0);
