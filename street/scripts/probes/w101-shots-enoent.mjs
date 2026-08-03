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
const MKDIR = /mkdirSync\s*\(\s*[`'"]shots/;

const risky = [], shotOnly = [];
for (const p of files) {
  const s = readFileSync(p, 'utf8');
  if (!/[`'"]shots\//.test(s)) continue;
  const guarded = MKDIR.test(s);
  if (NODE_WRITE.test(s) && !guarded) risky.push(p);
  else if (PW_SHOT.test(s) && !guarded) shotOnly.push(p);
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
process.exit(risky.length ? 1 : 0);
