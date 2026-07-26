// THERE ARE NO IMPORT CYCLES IN `src/proto`.
//
// ── why this is worth a check and not a comment ──
//
// GOTCHAS §28 is entirely about what a cycle costs here. A module in one can
// resolve to an **undefined namespace at collection time**, and a bundler orders
// modules differently from the browser's own loader, so the fault is REAL IN THE
// BUILT OUTPUT and absent in dev — the worst way round, because the bundle is
// what ships to the artifact and to Pages:
//
//     vite dev      (unbundled, native ESM)   8 of 8 declared doors arrive
//     vite preview  (rollup bundle)           7 of 8 — SEVENS is lost (then GOLDEN ACES)
//
// Two agents measured that and disagreed for a day, both honest, both
// reproducible. Nothing in the suite watches for the condition itself.
//
// I split `ct/street.ts` into four modules this session and had to design
// around exactly this — `ct/alley-floor.ts` exists as a leaf with no imports
// solely so `street -> alley -> cat -> street` could not close. That reasoning
// deserves a guard rather than a paragraph.
//
// ── COMMENTS ARE STRIPPED, and that is the whole reason this file is careful ──
//
// My first two cycle audits this session scanned RAW TEXT and both reported
// `ct/weeds.ts -> ct/weeds.ts`. I recorded it twice as "one pre-existing
// self-edge" and moved on. There is no such edge: line 9 of that file is a
// USAGE EXAMPLE in a comment —
//
//     //   import { weedTuft } from './weeds';
//
// so I published a defect that does not exist and dismissed it without looking,
// which is the mirror of the sign audit where I published an absence using an
// instrument that could not have seen the counter-example. Same root either way:
// the instrument could not distinguish the thing it was reporting on.
//
//   node scripts/no-import-cycles.mjs [--selftest]
import { readFileSync, readdirSync, statSync } from 'node:fs';

for (const a of process.argv.slice(2)) {
  if (a !== '--selftest') {
    console.error(`unknown argument ${JSON.stringify(a)} — this script takes --selftest and nothing else`);
    process.exit(2);
  }
}
const SELFTEST = process.argv.includes('--selftest');

const ROOT = 'src';
const files = [];
const walk = (d) => {
  for (const e of readdirSync(d)) {
    const p = `${d}/${e}`;
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.ts$/.test(e)) files.push(p);
  }
};
try { walk(ROOT); } catch {
  console.error(`\nABORTED — could not read ${ROOT}. Nothing measured (GOTCHAS §32).`);
  process.exit(3);
}

/** Remove block and line comments so a documented `import` is not an edge.
 *  Deliberately naive about strings containing `//` — an import specifier
 *  cannot contain one, and over-stripping would only ever LOSE an edge, which
 *  the population floor below would then catch. */
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

/** Resolve a relative specifier against the file that wrote it. */
function resolve(from, spec) {
  if (!spec.startsWith('.')) return null;                 // three, node builtins
  const parts = from.split('/').slice(0, -1);
  for (const seg of spec.split('/')) {
    if (seg === '.') continue;
    else if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  const base = parts.join('/');
  for (const c of [`${base}.ts`, `${base}/index.ts`]) if (files.includes(c)) return c;
  return null;
}

function graph(sources) {
  const g = new Map();
  let edges = 0;
  for (const { path, text } of sources) {
    const src = strip(text);
    const deps = new Set();
    const add = (spec) => { const t = resolve(path, spec); if (t) { deps.add(t); } };
    for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) add(m[1]);
    for (const m of src.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) add(m[1]);
    for (const m of src.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) add(m[1]);
    edges += deps.size;
    g.set(path, deps);
  }
  return { g, edges };
}

function cyclesIn(g) {
  const colour = new Map(); const found = [];
  const dfs = (n, path) => {
    colour.set(n, 1); path.push(n);
    for (const m of g.get(n) ?? []) {
      if (colour.get(m) === 1) found.push([...path.slice(path.indexOf(m)), m]);
      else if (!colour.has(m)) dfs(m, path);
    }
    path.pop(); colour.set(n, 2);
  };
  for (const n of g.keys()) if (!colour.has(n)) dfs(n, []);
  return found;
}

const { g, edges } = graph(files.map((f) => ({ path: f, text: readFileSync(f, 'utf8') })));

// ── POPULATION FIRST (GOTCHAS §34) ────────────────────────────────────────
// "No cycles" is an ABSENCE and absences are free over an empty graph. Both
// floors are MEASURED: 50 modules, 183 resolved edges today — 183 and not the
// 187 my raw-text version counted, because four of those were imports inside
// comments. The same four that produced the phantom weeds self-edge.  An over-eager
// comment strip or a resolver that stops matching would show up here as a
// collapsed edge count rather than as a green run.
const FILE_FLOOR = 30, EDGE_FLOOR = 100;
if (files.length < FILE_FLOOR || edges < EDGE_FLOOR) {
  console.error(`\nABORTED — ${files.length} modules and ${edges} edges, below the floors of ${FILE_FLOOR}/${EDGE_FLOOR}.`);
  console.error('  There are 50 and 183. A graph this small means this script stopped SEEING');
  console.error('  the imports, not that they were removed — and "no cycles" is free at zero.');
  process.exit(3);
}

const cycles = cyclesIn(g);
const short = (f) => f.replace('src/proto/', '');
console.log(`\n${files.length} modules under ${ROOT}, ${edges} resolved relative imports`);
for (const c of cycles) console.log(`  CYCLE  ${c.map(short).join(' -> ')}`);
console.log(cycles.length
  ? `\n${cycles.length} import cycle${cycles.length > 1 ? 's' : ''} — GOTCHAS §28: this can drop a declaration in the BUILT bundle while dev stays green.`
  : `\nno import cycles`);

if (SELFTEST) {
  // Break the CHECK'S VIEW, not the repository (GOTCHAS §34's second shape).
  console.log('\nselftest');
  const a = 'src/proto/ct/alley.ts', b = 'src/proto/ct/cat.ts';
  const planted = new Map([[a, new Set([b])], [b, new Set([a])]]);
  const caught = cyclesIn(planted).length >= 1;
  console.log(`  ${caught ? 'PASS' : 'FAIL'}  a two-module cycle is detected`);
  const acyclic = cyclesIn(new Map([[a, new Set([b])], [b, new Set()]])).length === 0;
  console.log(`  ${acyclic ? 'PASS' : 'FAIL'}  an acyclic pair is NOT reported`);
  // …and the one that is a regression test for my own error: a commented-out
  // import must not become an edge.
  const commented = graph([{ path: a, text: "//   import { x } from './cat';\nexport const y = 1;\n" }]);
  const noGhost = commented.edges === 0;
  console.log(`  ${noGhost ? 'PASS' : 'FAIL'}  an import inside a COMMENT is not an edge`);
  const blockCommented = graph([{ path: a, text: "/* import { x } from './cat'; */\nexport const y = 1;\n" }]);
  const noBlockGhost = blockCommented.edges === 0;
  console.log(`  ${noBlockGhost ? 'PASS' : 'FAIL'}  an import inside a BLOCK comment is not an edge`);
  const real = graph([{ path: a, text: "import { x } from './cat';\n" }]);
  const seesReal = real.edges === 1;
  console.log(`  ${seesReal ? 'PASS' : 'FAIL'}  a real import IS an edge (the strip does not eat everything)`);
  const ok = caught && acyclic && noGhost && noBlockGhost && seesReal;
  console.log(ok ? '\nSELFTEST PASSED' : '\nSELFTEST FAILED — this measures less than it claims');
  process.exit(ok ? 0 : 1);
}

process.exit(cycles.length ? 1 : 0);
