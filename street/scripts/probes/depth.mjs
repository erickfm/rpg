// Why the casino and not another room? A bundler initialises a module after its
// dependencies, so the DEEPEST module in the graph is initialised last -- and
// the last one is the one whose namespace is not ready when doors.ts's eager
// glob is read.
//
// That would reconcile two results: my claim that adding a module can move the
// loss, and mainline's finding that adding INERT LEAF probes did not. A leaf is
// depth 1. Only a module deeper than the current deepest could take its place.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const ROOT = 'src/proto/ct';
const files = readdirSync(ROOT).filter(f => f.endsWith('.ts'));
const deps = new Map();
for (const f of files) {
  const src = readFileSync(join(ROOT, f), 'utf8');
  const d = [...src.matchAll(/from '\.\/([a-z0-9-]+)'/g)].map(m => m[1] + '.ts').filter(x => files.includes(x));
  deps.set(f, [...new Set(d)]);
}
const memo = new Map();
const depth = (f, seen = new Set()) => {
  if (memo.has(f)) return memo.get(f);
  if (seen.has(f)) return 0;                        // cycle guard
  seen.add(f);
  const d = 1 + Math.max(0, ...(deps.get(f) || []).map(x => depth(x, new Set(seen))));
  memo.set(f, d); return d;
};
const rooms = files.filter(f => f.startsWith('int-'));
console.log('room                depth   chain');
const chain = (f, seen=new Set()) => {
  if (seen.has(f)) return [f + ' (cycle)'];
  seen.add(f);
  const ds = (deps.get(f)||[]);
  if (!ds.length) return [f];
  let best = null, bd = -1;
  for (const d of ds) { const v = depth(d); if (v > bd) { bd = v; best = d; } }
  return [f, ...chain(best, new Set(seen))];
};
for (const r of rooms.sort((a,b)=>depth(b)-depth(a)))
  console.log(`${r.replace('.ts','').padEnd(18)} ${String(depth(r)).padStart(3)}     ${chain(r).map(x=>x.replace('.ts','')).join(' → ')}`);
console.log('\ndeepest room is initialised LAST, and is the one whose namespace doors.ts may not see');
