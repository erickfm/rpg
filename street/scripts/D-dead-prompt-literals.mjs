// WHICH CHECKS ARE MATCHING PROMPT WORDING THAT NO LONGER EXISTS?
//
// A wired K's ATM cabinet to the bank wall in one line. The spot's label went
// from `FIRST FEDERAL — check balance` to `FIRST FEDERAL — use the machine`,
// and three separate checks broke, none of them A's:
//
//   M-bank-int-walk.mjs   CRASHED — `atmCash()` found the ATM by matching
//                         /check balance/ on the label, got null, and threw an
//                         unhandled TypeError 40 lines later. 52/52 to dead.
//   D-walk.mjs            two clauses red, asserting a `balance` word and a
//                         dollar figure that the cabinet no longer prints
//   D-confirmed-prompts   red, looking for the old label verbatim — my own
//                         registered check, and I did not notice for hours
//
// None of those is a fault in A's work, and no row on either side could have
// shown it. The common shape is that a check reached for a number or a subject
// through **someone else's wording**. A label is presentation: it belongs to
// whoever last wrote the interaction, and it changes on their afternoon, not
// yours.
//
// So this greps the harness for string and regex literals that are tested
// against a `label` or a prompt, and asks the only question that matters:
// **does that text still exist anywhere in `src/proto/`?** If it does not, the
// check is either already broken or matching nothing and quietly passing —
// GOTCHAS §34's shape, arrived at from the outside.
//
// IT IS A LINTER, NOT A WORLD CHECK: no browser, no build, ~50 ms, and it can
// run before anything is served. That is deliberate — the failure it catches is
// created by an edit, and the cheapest moment to catch it is the same edit.
//
//   node scripts/D-dead-prompt-literals.mjs [--selftest]
import { aim } from './lib/aim.mjs';
import { readdirSync, readFileSync } from 'node:fs';

for (const a of process.argv.slice(2)) {
  if (a !== '--selftest') {
    console.error(`unknown argument ${JSON.stringify(a)} — this script takes --selftest and nothing else`);
    process.exit(2);
  }
}
const SELFTEST = process.argv.includes('--selftest');

// THE HAYSTACK IS THE WORLD'S LIVE LABELS, NOT THE SOURCE TEXT — and getting
// that wrong is what this file spent three rounds proving.
//
// It began as a pure linter: grep the scripts for literals, grep the source for
// the same text, flag what is missing. No browser, ~50 ms. That premise is
// simply false, because **labels are composed at runtime**. `buy cereal` is
// built as `buy ${what} — $${price.toFixed(2)}` and the phrase appears nowhere
// in `src/`; so does `take the folded newspaper`. Searching source reported
// seven live, working couplings as dead.
//
// The set that actually answers the question is `__ct.spots()`, which publishes
// every registered spot's label ALREADY EVALUATED — live or not, so a spot
// gated behind a floor still counts. That costs a browser and it is worth it:
// a check that reports working code as broken is worse than no check.
//
// (The comment-stripping below still matters for the source half, which is kept
// as a second haystack: `check balance` survives in two crosstown.ts comments
// describing the rename, and a comment is a RECORD of wording, not the wording.)
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const SRC_TEXT = readdirSync('src/proto', { recursive: true })
  .filter((f) => String(f).endsWith('.ts'))
  .map((f) => strip(readFileSync(`src/proto/${f}`, 'utf8')))
  .join('\n');

const URL = aim('http://localhost:4181/');
const browser = await chromium.launch();
const page = await browser.newPage();
try { await page.goto(URL, { waitUntil: 'networkidle' }); }
catch { console.log(`\n  nothing serving at ${URL} — aborted, nothing measured`); await browser.close(); process.exit(3); }
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(page, URL);
const LABELS = (await page.evaluate(() => (window.__ct.spots() || []).map((s) => String(s.label)))).join('\n');
await browser.close();
/** Alive if the WORLD still says it, or the source still writes it.
 *
 *  CASE MATTERS AND MUST NOT. `B-verify-jail2.mjs` matches
 *  `/detention|jail|cell|sergeant/i` and the world publishes `into the HOUSE OF
 *  DETENTION` — alive, obviously, but a case-sensitive `includes` said dead and
 *  I nearly filed it. The regex carries `i`; the aliveness test has to as well. */
const LOWER = (LABELS + '\n' + SRC_TEXT).toLowerCase();
const alive = (needle) => LOWER.includes(needle.toLowerCase());

/** Literals this file must not flag: they are not prompt text. */
const IGNORE = /^(true|false|null|undefined|[0-9.]+|[a-z]{1,3})$/i;

const rows = [];
// ONLY LITERALS ACTUALLY USED AS A MATCHER. The first cut took every string on
// any line mentioning `label`, and reported 88 — nearly all of them console
// output, template interpolations like `${sp.label}`, and its own banner text.
// A report string is not a coupling; what couples you to someone else's wording
// is testing against it. So the shapes are named explicitly:
//
//     /LIT/.test(x)      .test(/LIT/)      x.match(/LIT/)
//     x.includes('LIT')  x === 'LIT'
//
// and only when the line also mentions a label, a prompt or a segment.
const MATCHERS = [
  // A REGEX LITERAL CAN CARRY FLAGS AND ESCAPES, and my first cut allowed
  // neither — it wanted `/lit/.test(`. The coupling that actually crashed M's
  // run was `/check balance|balance \$/i.test(q.label)`: an `i` flag between
  // the closing slash and `.test`, and a backslash inside the body. So the
  // tool built to catch that case did not catch it, and I only found out by
  // planting it (GOTCHAS §27 — a check nobody has watched fail proves nothing,
  // and this one had a green run and a passing selftest while blind to its
  // own founding example).
  /\/((?:[^/\\\n]|\\.){4,60})\/[gimsuy]*\s*\.test\s*\(/g,
  /\.(?:match|test|replace|search)\s*\(\s*\/((?:[^/\\\n]|\\.){4,60})\//g,
  /\.includes\s*\(\s*['"]([^'"\\\n]{4,60})['"]/g,
  /===?\s*['"]([^'"\\\n]{4,60})['"]/g,
];
for (const f of readdirSync('scripts').filter((f) => f.endsWith('.mjs'))) {
  const text = readFileSync(`scripts/${f}`, 'utf8');
  const all = text.split('\n');
  all.forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '');
    if (!/\.label|\bprompt\b|\bseg\b/.test(code)) return;
    // A SELFTEST ASSERTS A DEFECT ON PURPOSE, and its impossible needle is the
    // point of it. Checking only this line missed one, because the `(the bug)`
    // marker sat on the NEXT line of a two-line `say(...)` call — so the window
    // is the statement, not the line.
    const window2 = [line, all[i + 1] ?? '', all[i - 1] ?? ''].join(' ');
    if (/\(the bug\)|selftest/i.test(window2)) return;
    for (const re of MATCHERS) {
      for (const m of code.matchAll(re)) {
        // A NEGATED MATCH THAT FINDS NOTHING IS HARMLESS BY CONSTRUCTION.
        // `filter(q => !/stand up|stop watching/.test(q.label))` excludes what
        // it matches, so an alternative that matches nothing simply excludes
        // nothing — and G wrote `stop watching` FORWARD, against C's open row
        // for that very prompt. Flagging it would be telling a builder off for
        // anticipating a feature. Only positive matches — a find(), an
        // includes(), an === — can silently select nothing and pass.
        const before = code.slice(Math.max(0, m.index - 3), m.index);
        if (/[!]\s*$/.test(before)) continue;
        const lit = m[1];
        if (lit.includes('${')) continue;                 // interpolated, not a literal
        // AN ALTERNATION IS ONLY DEAD IF EVERY BRANCH IS. `find(q =>
        // /use the machine|check balance/i.test(q.label))` is a DEFENSIVE
        // fallback: the first branch is the current label, the second is the
        // old one kept for compatibility. The matcher succeeds, so flagging the
        // stale branch would be telling somebody off for being careful — the
        // positive-position twin of the negation case G taught me.
        const branches = lit.split('|');
        if (branches.some((alt) => {
          const n = alt.replace(/\\([$.*+?^{}()[\]])/g, '$1').replace(/^\[E\]\s*/, '').trim();
          return n.length >= 4 && /[a-z]{4}/i.test(n) && !/[\\+*?\[\]{}()^$]/.test(alt) && alive(n);
        })) continue;
        for (const alt of branches) {
          // THE `[E] ` PREFIX IS THE HUD'S, NOT THE SOURCE'S. A spot registers
          // `enter No. 227`; the HUD prints `[E] enter No. 227`. Comparing the
          // printed form against the source finds nothing and flags a check
          // that is perfectly well coupled — my own, first time out.
          const needle = alt.replace(/\\([$.*+?^{}()[\]])/g, '$1').replace(/^\[E\]\s*/, '').trim();
          // A PATTERN IS NOT A LITERAL. `\d+ letters?` cannot be searched for
          // in the source as text — it describes a shape, and the shape may be
          // perfectly alive while the exact characters never appear. Only
          // needles that are plain text after unescaping mean anything here.
          if (/[\\+*?\[\]{}()^$]/.test(alt)) continue;
          if (needle.length < 4 || !/[a-z]{4}/i.test(needle)) continue;
          if (IGNORE.test(needle)) continue;
          if (alive(needle)) continue;
          rows.push({ file: f, line: i + 1, needle, code: code.trim().slice(0, 78) });
        }
      }
    }
  });
}

// de-duplicate: one report per (file, needle)
const seen = new Set();
const dead = rows.filter((r) => { const k = r.file + '|' + r.needle; if (seen.has(k)) return false; seen.add(k); return true; });

console.log(`\n  ${dead.length} prompt/label literal${dead.length === 1 ? '' : 's'} in scripts/ that no longer appear in src/proto/\n`);
for (const r of dead) {
  console.log(`  ${r.file}:${r.line}`);
  console.log(`      matches ${JSON.stringify(r.needle)} — not in the source`);
  console.log(`      ${r.code}`);
}

if (SELFTEST) {
  // The honest self-test is that it FINDS a literal it should. Plant one that
  // cannot exist, and require it to be caught.
  console.log('\nselftest — a literal that cannot exist must be CAUGHT');
  const planted = 'ZZQX no such prompt anywhere';
  const found = !alive(planted);
  console.log(found
    ? '\nSELFTEST PASSED — a needle absent from the source is detectable'
    : '\nSELFTEST FAILED — the source contains the planted needle, so this proves nothing');
  process.exit(found ? 0 : 1);
}

if (dead.length) {
  console.log('\n  Each of these is a check reaching for something through SOMEBODY ELSE\'S WORDING.');
  console.log('  Match the noun the roster owns, not the verb the interaction owns.');
  process.exit(1);
}
console.log('  every literal a check matches on still exists in the world it checks');
