// Fail the build when a module is written but never constructed.
//
// This has shipped FIVE times: int-casino, int-hotel, int-tax, park and lot
// were each finished, committed, and never put in the world. The shape is
// always the same and it is nobody's carelessness — a builder owns
// `ct/<thing>.ts` and does good work in it, but the one `buildThing(ctx)` line
// that constructs it lives in `crosstown.ts`, which is desk-owned. So the
// builder cannot wire its own module, the desk does not know it is waiting,
// and nothing anywhere fails. The user goes looking for the thing they asked
// for and finds nothing there. Twice, now.
//
// Nothing catches this today: it typechecks, it builds, the sweep is clean and
// the fingerprint is stable, because an unreferenced module is simply absent.
// The only detector was somebody walking to the right corner of the world.
//
// So: every `ct/*.ts` that exports a `build*` function must have that symbol
// imported AND called somewhere under `src/proto/`. If it is deliberately not
// wired, it goes in ALLOWED below with a reason — opting out should be a
// visible decision, not an accident.
//
// STOOD DOWN AS A GATE. It ran ahead of tsc in `npm run build` for one commit;
// the desk stood that down in favour of the better answer — the user asked for
// automatic incorporation, and builder F is generalising ct/interior.ts's
// import.meta.glob to all world modules. A check that a contract is followed is
// worth far less than a contract that cannot be skipped, and that is right.
//
// Kept as a DIAGNOSTIC (`npm run wiring`, add -v for the full inventory),
// because it is still useful in two ways:
//
//   1. While F generalises, `npm run wiring -v` prints how all 23 build*
//      exports are constructed today — which is the inventory that work needs.
//   2. Afterwards, a glob covers a module only if the module matches the
//      pattern and exports the expected name. Something misnamed still falls
//      through the contract silently, and this still says so.
//
// It does not fail anything now. Nothing is gated on it.
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname, posix } from 'node:path';

const CT = 'src/proto/ct';
const ROOT = 'src/proto';

/**
 * Modules that export a build* function and are deliberately NOT constructed.
 * Every entry needs a reason. An empty allow-list is the healthy state.
 */
const ALLOWED = {
  // 'ct/example.ts': 'why this one is intentionally not in the world',

  // park and lot were allow-listed while this gated the build, so it would not
  // break everyone for work already in F's hands. Nothing is gated now, so
  // they are better reported honestly: they ARE unconstructed until F lands.
};

// ── collect every exported build* symbol, and every file under src/proto ────
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : []);

const files = walk(ROOT);
const sources = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]));

const decl = /^export\s+(?:async\s+)?(?:function|const)\s+(build[A-Z]\w*)/gm;
const exported = [];
for (const f of readdirSync(CT).filter((n) => n.endsWith('.ts'))) {
  const path = join(CT, f);
  const src = sources.get(path) ?? readFileSync(path, 'utf8');
  for (const m of src.matchAll(decl)) exported.push({ path, rel: `ct/${f}`, sym: m[1] });
}

// ── modules constructed through `import.meta.glob` ──────────────────────────
//
// ct/interior.ts discovers every ./int-*.ts with a Vite eager glob and calls
// whatever build…() each one exports. Those rooms ARE in the world, and a
// naming-only check calls all seven of them orphans — which would fail the
// build on working code, and a check that cries wolf gets deleted. So resolve
// globs to the files they actually match.
const globbed = new Map();                          // file -> the file that globs it
for (const [f, src] of sources) {
  // [^(]* rather than [^>]* on the type argument: the real call is
  // import.meta.glob<Record<string, unknown>>('./int-*.ts', …) and a
  // first-> match stops inside Record<…>, which silently found no globs at all.
  for (const g of src.matchAll(/import\.meta\.glob\s*(?:<[^(]*>)?\s*\(\s*['"]([^'"]+)['"]/g)) {
    const pat = g[1];
    // only a glob that INVOKES what it finds constructs anything; one that
    // merely collects modules is a registry, not a construction site
    if (!/\)\s*\(\s*\w+\s*\)|\]\s*as[^)]*\)\s*\(/.test(src)) continue;
    const base = posix.normalize(posix.join(dirname(f).split(/[\\/]/).join('/'), dirname(pat)));
    const rx = new RegExp('^' + pat.split('/').pop().replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$');
    for (const cand of files) {
      const cd = dirname(cand).split(/[\\/]/).join('/');
      if (cd === base && rx.test(cand.split(/[\\/]/).pop())) globbed.set(cand, f);
    }
  }
}

// ── modules constructed through ct/world.ts's registrant glob ───────────────
//
// The world moved to a registrant pattern: a module exports `register(ctx)`
// (plus an optional ORDER) and ct/world.ts globs ./*.ts and calls it. So the
// build* function is now invoked from inside its OWN module — which the
// "a module calling itself proves nothing" rule below deliberately ignores,
// and this script started reporting interiors, park and lot as orphans while
// they were demonstrably in the world. Exporting `register` IS being wired.
const REGISTER = /^export\s+(?:async\s+)?(?:function|const)\s+register\b/m;

// ── is it imported and called from somewhere that is not itself? ────────────
const orphans = [], wired = [];
for (const { path, rel, sym } of exported) {
  if (ALLOWED[rel]) continue;
  if (REGISTER.test(sources.get(path) ?? '')) { wired.push(`${rel} ${sym}() via register() in ct/world.ts`); continue; }
  if (globbed.has(path)) { wired.push(`${rel} ${sym}() via import.meta.glob in ${globbed.get(path)}`); continue; }
  let importedBy = null, calledBy = null;
  for (const [f, src] of sources) {
    if (f === path) continue;                       // a module calling itself proves nothing
    // the symbol named in an import list from a relative module
    if (!importedBy && new RegExp(`import\\s*{[^}]*\\b${sym}\\b[^}]*}\\s*from\\s*['"]\\.`, 's').test(src)) importedBy = f;
    // ...and actually invoked, not merely re-exported
    if (!calledBy && new RegExp(`\\b${sym}\\s*\\(`).test(src)) calledBy = f;
    if (importedBy && calledBy) break;
  }
  if (!importedBy || !calledBy) orphans.push({ rel, sym, importedBy, calledBy });
  else wired.push(`${rel} ${sym}() from ${calledBy}`);
}

if (process.argv.includes('-v')) for (const w of wired) console.log('  wired  ' + w);
// Print every allow-list entry every time. A silent allow-list is how a
// deliberate exception rots into a forgotten one, which is the failure this
// script exists to stop — one level up.
for (const [mod, why] of Object.entries(ALLOWED)) {
  console.log(`wiring: ${mod} NOT constructed, allow-listed — ${why}`);
}
if (!orphans.length) {
  console.log(`wiring: ${exported.length} build* exports, all constructed`
    + (Object.keys(ALLOWED).length ? ` (${Object.keys(ALLOWED).length} allow-listed)` : ''));
  process.exit(0);
}

console.error('\nWIRING CHECK FAILED — module written but never constructed\n');
for (const o of orphans) {
  const why = !o.importedBy ? 'never imported anywhere under src/proto/'
    : 'imported, but never called';
  console.error(`  ${o.rel}  exports ${o.sym}()  —  ${why}`);
}
console.error(`
This is finished work that is not in the world. It typechecks, it builds and
the sweep is clean, because an unreferenced module is simply absent — which is
why this has shipped five times without anyone noticing.

Fix it one of two ways:

  1. Construct it. The call goes wherever that kind of thing is built —
     usually one line in src/proto/crosstown.ts. If you do not own that file,
     say so in street/notes/BLOCKED-<you>.md and the desk will wire it; do not
     leave it and move on, which is how the five got here.

  2. If it is genuinely not meant to be in the world yet, add it to ALLOWED in
     scripts/check-wiring.mjs WITH A REASON. Opting out is fine. Opting out
     silently is what this check exists to stop.
`);
process.exit(1);
