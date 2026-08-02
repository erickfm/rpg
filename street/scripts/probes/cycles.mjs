// THE IMPORT CYCLES, mapped. ct/doors.ts reads DOOR off a namespace that can be
// undefined when the module is mid-cycle -- that took the world down once
// (BLOCKED-AUDIT-seams.md, fixed by 84d59e04) and is now costing the casino its
// declared door. Mainline reports FOUR modules resolving undefined, up from one.
//
// So map every cycle in src/proto, statically, and say which modules are inside
// one and which of those declare something that can be lost.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const ROOT = 'src/proto';
const files = [];
(function walk(d) { for (const e of readdirSync(d, { withFileTypes: true })) {
  const p = join(d, e.name);
  if (e.isDirectory()) walk(p); else if (e.name.endsWith('.ts')) files.push(p);
} })(ROOT);
const key = f => f.replace(/\\/g,'/').replace(/^src\/proto\//,'').replace(/\.ts$/,'');
const graph = new Map();
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const deps = new Set();
  for (const m of src.matchAll(/^\s*import\s[^'"]*['"](\.[^'"]+)['"]/gm)) {
    let t = m[1];
    const base = key(f).split('/').slice(0, -1).join('/');
    let r = t.startsWith('./') ? (base ? base + '/' + t.slice(2) : t.slice(2))
          : t.startsWith('../') ? (() => { const b = base.split('/'); let s = t;
              while (s.startsWith('../')) { b.pop(); s = s.slice(3); }
              return [...b, s].filter(Boolean).join('/'); })() : t;
    deps.add(r.replace(/\.ts$/,''));
  }
  graph.set(key(f), [...deps].filter(d => graph.has(d) || files.some(x => key(x) === d)));
}
// Tarjan
let idx = 0; const st = [], on = new Set(), I = new Map(), L = new Map(), sccs = [];
const strong = v => {
  I.set(v, idx); L.set(v, idx); idx++; st.push(v); on.add(v);
  for (const w of (graph.get(v) || [])) {
    if (!I.has(w)) { strong(w); L.set(v, Math.min(L.get(v), L.get(w))); }
    else if (on.has(w)) L.set(v, Math.min(L.get(v), I.get(w)));
  }
  if (L.get(v) === I.get(v)) { const c = []; let w;
    do { w = st.pop(); on.delete(w); c.push(w); } while (w !== v);
    if (c.length > 1) sccs.push(c); }
};
for (const v of graph.keys()) if (!I.has(v)) strong(v);
const edges = [...graph.values()].reduce((a,v)=>a+v.length,0);
console.log(`${files.length} modules under ${ROOT}, ${edges} static import edges resolved`);
const noDeps = [...graph.entries()].filter(([k,v])=>v.length===0).length;
console.log(`${noDeps} modules resolved ZERO dependencies\n`);
// glob-based dependencies are invisible to a static import graph
const globbers = files.filter(f => /import\.meta\.glob/.test(readFileSync(f,'utf8')));
console.log(`modules using import.meta.glob (dependencies NOT visible here): ${globbers.length}`);
for (const g of globbers) console.log(`   ${key(g)}`);
console.log('');
if (!sccs.length) console.log('no import cycles found');
for (const c of sccs.sort((a,b)=>b.length-a.length)) {
  console.log(`CYCLE of ${c.length}:`);
  for (const m of c.sort()) {
    const src = readFileSync(join(ROOT, m + '.ts'), 'utf8');
    const declares = [];
    if (/export\s+const\s+DOOR\b/.test(src)) declares.push('DOOR');
    if (/export\s+const\s+ORDER\b/.test(src)) declares.push('ORDER');
    if (/export\s+function\s+register\b/.test(src)) declares.push('register()');
    console.log(`   ${m.padEnd(28)} ${declares.length ? 'declares ' + declares.join(', ') : ''}`);
  }
}
