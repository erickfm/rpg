// EVERY `file.ts:123` CITATION POINTS AT A LINE THAT EXISTS.
//
// The sibling of `hashes-resolve.mjs`, and the same argument one axis over.
// GOTCHAS §36 made us stop citing commit hashes nobody else can resolve; this
// is the other kind of pointer we write constantly — into SOURCE, by line — and
// it rots for a different reason: not because the object is unreachable, but
// because somebody moved the code.
//
// ── the failure this guards, which happened, and was mine ──
//
// I split `ct/street.ts` from 2294 lines into four files. Two citations were
// left pointing past the end of what remained:
//
//     street.ts line 1188   the bay painter — moved to ct/bodega-corner.ts
//     street.ts line 1602   the awning tilt — moved to ct/bodega-corner.ts
//
// (Written "line 1188" rather than in citation form ON PURPOSE. The first draft
// quoted them the normal way and this check went red on its own documentation —
// which is a check nobody can keep green, and the fix is to not be a citation
// rather than to special-case my own file, because that exemption would hide a
// real citation the day this script legitimately makes one.)
//
// The second one was in **`notes/LEDGER.md`, inside the auditor's CONFIRMED row
// for a user ruling** — the project's own accountability record, pointing at a
// line 600 past the end of the file it named. That is the same shape as the
// canfail needles the same refactor broke (`3fcd8e9dc`) and as the hand-typed
// bay geometry before it was published: **a hard-coded quotation of somebody
// else's file, which a refactor breaks silently and a bug never does.** Three
// instances in one session is a pattern, not an incident.
//
// ── what it does and does NOT claim ──
//
// It asserts the WEAK, CHECKABLE thing: the file resolves and has at least that
// many lines. It does NOT claim the line still says what the citing text says it
// says — that needs a human, and a check that pretended otherwise would be worse
// than none. The weak claim is still worth having: it caught both of mine,
// because a file that loses 1300 lines takes its citations out of range.
//
//   node scripts/citations-resolve.mjs [--selftest]
import { readFileSync, readdirSync, statSync } from 'node:fs';

for (const a of process.argv.slice(2)) {
  if (a !== '--selftest') {
    console.error(`unknown argument ${JSON.stringify(a)} — this script takes --selftest and nothing else`);
    process.exit(2);
  }
}
const SELFTEST = process.argv.includes('--selftest');

const ROOTS = ['notes', 'scripts', 'src/proto'];
const files = [];
const walk = (d) => {
  for (const e of readdirSync(d)) {
    const p = `${d}/${e}`;
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(md|mjs|ts)$/.test(e)) files.push(p);
  }
};
for (const r of ROOTS) { try { walk(r); } catch { /* a root may not exist */ } }

const lineCache = new Map();
const linesIn = (f) => {
  if (!lineCache.has(f)) {
    try { lineCache.set(f, readFileSync(f, 'utf8').split('\n').length); }
    catch { lineCache.set(f, -1); }
  }
  return lineCache.get(f);
};

/** Collect `basename.ts:123` / `basename.mjs:123` pointers, tolerating a `~`
 *  (we write a leading `~` when the line is approximate) and any leading
 *  path. Only citations whose basename resolves to a real file are counted —
 *  a name we cannot resolve is not evidence of anything. */
function collect(sources) {
  const out = [];
  for (const { path, text } of sources) {
    for (const m of text.matchAll(/([a-zA-Z0-9_-]+\.(?:ts|mjs)):~?(\d+)/g)) {
      const base = m[1], n = +m[2];
      const target = ['src/proto/ct/' + base, 'src/proto/' + base, 'scripts/' + base]
        .find((c) => linesIn(c) > 0);
      if (!target) continue;
      out.push({ from: path, base, n, target, len: linesIn(target) });
    }
  }
  return out;
}

const cites = collect(files.map((f) => ({ path: f, text: readFileSync(f, 'utf8') })));

// ── POPULATION FIRST (GOTCHAS §34) ────────────────────────────────────────
// The verdict is an ABSENCE — "no citation is out of range" — and an absence is
// free over an empty set. The floor is MEASURED: 206 resolvable citations today.
// 120 leaves generous room for notes being archived while still catching a
// regex or a root that has stopped matching anything.
//
// 206, not the 219 my first scratch version printed: that one listed both
// `src/proto` and `src/proto/ct` as roots and walked the nested one twice. A
// floor set against a miscount is the exact thing GOTCHAS §34 means by "measure
// the floor, do not remember it" — I nearly wrote the inflated number down.
const FLOOR = 120;
if (cites.length < FLOOR) {
  console.error(`\nABORTED — found only ${cites.length} resolvable citations, below the floor of ${FLOOR}.`);
  console.error('  There are 206. A number this low means this script stopped SEEING them,');
  console.error('  not that they were removed — and "none is dead" is free at zero.');
  process.exit(3);
}

const audit = (list) => list.filter((c) => c.n > c.len);
const dead = audit(cites);

console.log(`\n${cites.length} file:line citations across ${ROOTS.join(', ')}`);
for (const c of dead) {
  console.log(`  DEAD  ${`${c.base}:${c.n}`.padEnd(22)} ${c.target} has ${c.len} lines   cited in ${c.from}`);
}
console.log(dead.length
  ? `\n${dead.length} citation${dead.length > 1 ? 's point' : ' points'} past the end of the file it names — the code moved and the pointer did not.`
  : `\nall ${cites.length} citations point at a line that exists`);

if (SELFTEST) {
  // Break the CHECK'S VIEW, not the repository — GOTCHAS §34's second shape,
  // which a mutation of the world cannot reach. Nothing here edits a file that
  // is not mine; the predicate IS the check, so exercising it over a planted
  // citation is the honest test.
  console.log('\nselftest — a citation past the end of its file must be caught');
  const realFile = 'src/proto/ct/alley-floor.ts';
  const planted = collect([{ path: '(planted)', text: `see alley-floor.ts:${linesIn(realFile) + 500}` }]);
  const caughtDead = planted.length === 1 && audit(planted).length === 1;
  console.log(`  ${caughtDead ? 'PASS' : 'FAIL'}  a line past EOF is reported`);
  // …and an in-range citation must NOT be reported, or the check says everything
  // is broken and means nothing.
  const good = collect([{ path: '(planted)', text: 'see alley-floor.ts:2' }]);
  const quietOnGood = good.length === 1 && audit(good).length === 0;
  console.log(`  ${quietOnGood ? 'PASS' : 'FAIL'}  a line inside the file is NOT reported`);
  // …and the population floor must refuse an empty set rather than pass it.
  const floorBites = 0 < FLOOR;
  console.log(`  ${floorBites ? 'PASS' : 'FAIL'}  an empty set is below the floor, so it aborts rather than passing`);
  const ok = caughtDead && quietOnGood && floorBites;
  console.log(ok
    ? '\nSELFTEST PASSED — it catches a dead pointer, stays quiet on a live one, and cannot pass at zero'
    : '\nSELFTEST FAILED — this measures less than it claims');
  process.exit(ok ? 0 : 1);
}

process.exit(dead.length ? 1 : 0);
