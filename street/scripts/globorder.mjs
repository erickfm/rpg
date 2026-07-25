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
const PAIR = /"\.\/([A-Za-z0-9_-]+\.ts)":([A-Za-z_$][\w$]*)/g;
const pairs = [...src.matchAll(PAIR)].map(m => ({ at: m.index, key: m[1], id: m[2] }));
// group pairs that sit within 40 chars of each other -> one literal
const groups = [];
for (const p of pairs) {
  const g = groups[groups.length - 1];
  if (g && p.at - g.end < 60) { g.items.push(p); g.end = p.at + p[0]?.length || p.at + 30; }
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
let bad = 0;
for (const g of groups) {
  if (g.items.length < 3) continue;                    // a real glob has many keys
  const late = g.items.filter(p => { const d = declAt(p.id); return d !== null && d > g.start; });
  console.log(`glob literal at byte ${g.start.toLocaleString()} — ${g.items.length} entries, ${late.length} bound AFTER it`);
  for (const p of late) {
    bad++;
    console.log(`   ** ${p.key.padEnd(20)} id ${p.id.padEnd(4)} declared at ${declAt(p.id).toLocaleString()} — ${(declAt(p.id)-g.start).toLocaleString()} bytes too late`);
  }
}
console.log(bad
  ? `\n${bad} binding(s) read by a glob before they exist. Whatever those modules declare is silently dropped.`
  : '\nevery globbed binding is declared before the glob that reads it');
// Finding NO glob literal means the bundle shape changed and this scan matched
// nothing -- which is "I could not look", not "there is nothing wrong". Exiting
// 0 there would be a vacuous pass that survives any future rollup change.
if (groups.length === 0) {
  console.error('\n  CANNOT ANSWER — no eager-glob object literal matched in the bundle.');
  console.error('  The bundle shape has changed; re-derive the pattern before trusting a green.');
  process.exit(3);
}
process.exit(bad ? 1 : 0);
