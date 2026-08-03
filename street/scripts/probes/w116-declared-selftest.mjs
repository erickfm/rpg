// Item 287 — SELF-TEST FOR THE DECLARED-FAILURE MECHANISM, in all four directions.
//
// A mechanism that lets a known red go quiet is exactly the kind of thing that
// silently becomes permanent cover, so it does not get to ship on the strength
// of "I read it and it looks right". GOTCHAS 79 — a selftest that is never
// invoked is not a selftest — so this is wired into `npm run checks`' reach via
// `interiors-walk --selftest-declared`, and it asserts the RED cases, not just
// the green one.
//
// Usage: node scripts/probes/w116-declared-selftest.mjs
import { classify } from '../lib/declared-failures.mjs';

let failed = 0;
const is = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n        got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
};

const DECL = [['jail: light', 'item 240'], ['hotel: station', 'no spot published']];

// 1. a declared failure goes quiet, and is NOT counted bad
is('declared failure -> decl, bad 0',
  (({ bad, decl }) => ({ bad, decl }))(classify([[false, 'jail: light', 'd'], [true, 'x: y', 'd']], DECL.slice(0, 1))),
  { bad: 0, decl: 1 });

// 2. an UNDECLARED failure is still red — the mechanism must not swallow news.
//    Only `bank:` is covered by this run, so neither declaration counts missing.
is('undeclared failure -> bad 1',
  (({ bad, decl }) => ({ bad, decl }))(classify([[false, 'bank: something new', 'd']], DECL)),
  { bad: 1, decl: 0 });

// 3. ROT — a declared leg that now PASSES is RED, not quietly green.
//    This is the one that stops a declaration becoming permanent cover.
is('declared leg now passes -> bad',
  (({ bad, decl }) => ({ bad, decl }))(classify([[true, 'jail: light', 'd']], DECL.slice(0, 1))),
  { bad: 1, decl: 0 });

// 4. MISSING — a declaration whose leg was RENAMED, in a run that DID cover its
//    room, is RED (GOTCHAS 34). This is the rename guard and it must stay sharp.
is('declared leg renamed, room still walked -> bad + named',
  (({ bad, missing }) => ({ bad, missing }))(
    classify([[true, 'hotel: some other leg', 'd']], DECL.slice(1))),
  { bad: 1, missing: ['hotel: station'] });

// 4b. …but a declaration for a room this run never walked is NOT red. Measured
//     against the real script: before this, `interiors-walk bodega` exited 1
//     with 30/30 legs green, purely because the other rooms' declarations had
//     nothing to match. An exit code red for a reason unrelated to the world is
//     the disease, not the cure.
is('declaration for a room this run did not walk -> not bad, reported separately',
  (({ bad, missing, notCovered }) => ({ bad, missing, notCovered }))(
    classify([[true, 'bodega: a leg', 'd']], DECL)),
  { bad: 0, missing: [], notCovered: ['jail: light', 'hotel: station'] });

// 5. the ordinary all-green case is green
is('nothing declared, nothing failing -> bad 0',
  (({ bad, decl, passed }) => ({ bad, decl, passed }))(classify([[true, 'a: b', 'd'], [true, 'c: d', 'd']], [])),
  { bad: 0, decl: 0, passed: 2 });

console.log(failed === 0 ? 'DECLARED SELFTEST OK — 6 cases, 3 of them red cases'
  : `DECLARED SELFTEST BAD — ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
