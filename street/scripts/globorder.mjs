// ANY MODULE BOUND AFTER THE GLOB THAT READS IT LOSES WHATEVER THE GLOB WANTED.
//
// `import.meta.glob(..., { eager: true })` compiles to an object literal whose
// values are module namespace bindings. If a binding is declared LATER in the
// bundle than the literal, its value is `undefined` at construction — silently.
// That is how the casino's door stopped being collected: seven rooms bound
// before byte 810,068, int-casino bound at 811,650.
//
// This reads the built bundle and reports every such case. No runtime, no
// browser; it is a property of the emitted file.
//
// Run after `npm run build`. If this ever prints a row, something the world
// declares is being dropped without an error.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
const DIR = 'dist/assets';
const bundle = readdirSync(DIR).filter(f => /^index-.*\.js$/.test(f))
  .map(f => ({ f, t: statSync(join(DIR, f)).mtimeMs })).sort((a,b)=>b.t-a.t)[0];
if (!bundle) { console.log('no bundle in dist/assets — run npm run build'); process.exit(1); }
const src = readFileSync(join(DIR, bundle.f), 'utf8');
console.log(`${bundle.f}  ${src.length.toLocaleString()} bytes\n`);

// every glob object literal: a run of "./name.ts":ident pairs
// FACTORED so --selftest can drive the REAL logic over synthetic bundles rather
// than a copy of it. A selftest that re-implements what it tests proves only
// that two copies agree, which is the circularity this audit exists to catch.
const analyse = (src) => {
  const PAIR = /"\.\/([A-Za-z0-9_-]+\.ts)":([A-Za-z_$][\w$]*)/g;
  const pairs = [...src.matchAll(PAIR)].map(m => ({ at: m.index, key: m[1], id: m[2] }));
  const groups = [];
  for (const p of pairs) {
    const g = groups[groups.length - 1];
    if (g && p.at - g.end < 60) { g.items.push(p); g.end = p.at + 30; }
    else groups.push({ start: p.at, end: p.at + 30, items: [p] });
  }
  const declAt = (id) => {
    let best = null;
    for (const pat of [`const ${id}=`, `,${id}=`, `;${id}=`, `{${id}=`, `var ${id}=`]) {
      const i = src.indexOf(pat);
      if (i !== -1 && (best === null || i < best)) best = i;
    }
    return best;
  };
  const real = groups.filter(g => g.items.length >= 3);
  const findings = [];
  for (const g of real)
    for (const p of g.items) {
      const d = declAt(p.id);
      if (d !== null && d > g.start) findings.push({ g, p, d });
    }
  return { groups: real, findings, declAt };
};

const { groups, findings, declAt } = analyse(src);
for (const g of groups) {
  const late = findings.filter(f => f.g === g);
  console.log(`glob literal at byte ${g.start.toLocaleString()} — ${g.items.length} entries, ${late.length} bound AFTER it`);
  for (const f of late)
    console.log(`   ** ${f.p.key.padEnd(20)} id ${f.p.id.padEnd(4)} declared at ${f.d.toLocaleString()} — ${(f.d-g.start).toLocaleString()} bytes too late`);
}
const bad = findings.length;
console.log(bad
  ? `\n${bad} binding(s) read by a glob before they exist. Whatever those modules declare is silently dropped.`
  : '\nevery globbed binding is declared before the glob that reads it');

// --selftest, D-walk's convention: invert known truths, require each to fail.
// The synthetic bundles below drive analyse() itself.
if (process.argv.includes('--selftest')) {
  const K = (n) => Array.from({length:n},(_,i)=>`"./m${i}.ts":x${i}`).join(",");
  let caught = 0, total = 0;
  const must = (label, cond) => { total++; if (cond) { caught++; console.log(`  caught: ${label}`); }
    else console.log(`  ** NOT CAUGHT: ${label}`); };

  // 1. a binding declared AFTER its glob must be found
  must('a binding declared after its glob is detected',
    analyse(`const G={${K(4)}};const x0=1;`).findings.length > 0);
  // 2. the same bundle with the binding BEFORE must be clean
  must('the same bundle with bindings declared first is clean',
    analyse(`const x0=1,x1=1,x2=1,x3=1;const G={${K(4)}};`).findings.length === 0);
  // 3. a bundle with no glob at all must find no literal, not pass quietly
  must('a bundle with no glob literal yields no groups (the exit-3 path)',
    analyse('const a=1;const b=2;').groups.length === 0);

  console.log(`\n  ${caught}/${total} inverted truths behaved as required`);
  process.exit(caught === total ? 0 : 1);
}

// Finding NO glob literal means the bundle shape changed and this scan matched
// nothing -- which is "I could not look", not "there is nothing wrong".
if (groups.length === 0) {
  console.error('\n  CANNOT ANSWER — no eager-glob object literal matched in the bundle.');
  console.error('  The bundle shape has changed; re-derive the pattern before trusting a green.');
  process.exit(3);
}
process.exit(bad ? 1 : 0);
