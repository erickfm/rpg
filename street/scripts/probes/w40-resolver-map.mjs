// BLAST RADIUS of a change to pickSpot's tiering, over the whole world.
//
// `fp.ts` is the highest-risk file in the project, so before/after here is not
// "the two cases I care about" — it is every registered [E] in the world, from
// a ring of stand-offs, at eight headings each. ~200 spots x 3 offsets x 8
// headings, and the winning label recorded for each.
//
// IT CALLS THE WORLD'S OWN pickSpot. `/src/proto/fp.ts` is imported into the
// page, so this is the real resolver and not a model of it — a model would go
// stale the moment I edited the thing it models, which is the whole point of
// running it.
//
// The `visible` callback is deliberately NOT supplied: it is a FILTER applied
// before any tiering and I am not touching it, so leaving it out widens the
// candidate set (making the diff more sensitive, not less) without changing
// what is being compared. Live-prompt truth is checked separately by
// w40-bed-vs-door.mjs; this is a differ, not an oracle.
//
//   SHOT_URL=http://localhost:4188/ node scripts/probes/w40-resolver-map.mjs before
//   ...edit fp.ts...
//   SHOT_URL=http://localhost:4188/ node scripts/probes/w40-resolver-map.mjs after
//   SHOT_URL=http://localhost:4188/ node scripts/probes/w40-resolver-map.mjs diff
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { reportWorld } from '../lib/which-world.mjs';

const MODE = process.argv[2] ?? 'before';
const OUT = (t) => `shots/w40-resolver-${t}.json`;

if (MODE === 'diff') {
  const a = JSON.parse(readFileSync(OUT('before'), 'utf8'));
  const c = JSON.parse(readFileSync(OUT('after'), 'utf8'));
  const keys = [...new Set([...Object.keys(a), ...Object.keys(c)])].sort();
  const changed = keys.filter((k) => a[k] !== c[k]);
  console.log(`${keys.length} poses; ${changed.length} changed (${(100 * changed.length / keys.length).toFixed(1)}%)\n`);
  const buckets = new Map();
  for (const k of changed) {
    const sig = `${a[k] ?? '(none)'}  ->  ${c[k] ?? '(none)'}`;
    if (!buckets.has(sig)) buckets.set(sig, []);
    buckets.get(sig).push(k);
  }
  for (const [sig, ks] of [...buckets].sort((x, y) => y[1].length - x[1].length)) {
    console.log(`  ${String(ks.length).padStart(4)}x  ${sig}`);
    console.log(`         e.g. ${ks[0]}`);
  }
  process.exit(0);
}

const URL = aim('http://localhost:4188/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.waitForTimeout(2000);
await reportWorld(p, URL);

const stations = await p.evaluate(() => window.__ct.spots().map((s, i) => ({ i, x: s.x, z: s.z, label: s.label })));
console.log(`${stations.length} registered spots to visit`);

const out = {};
let n = 0;
for (const st of stations) {
  const gy = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [st.x, st.z]);
  // put the player there so the room's ok() predicates go live, then evaluate
  // the whole pose ring in ONE page call against the world's own resolver
  await p.evaluate(([x, z, gy]) => window.__ct.warp(x, z, 0, gy, 0), [st.x, st.z, gy]);
  await p.waitForTimeout(60);
  const res = await p.evaluate(async ([sx, sz, si]) => {
    const m = await import('/src/proto/fp.ts');
    const live = window.__ct.spots()
      .map((s, i) => ({ ...s, i }))
      .filter((s) => s.ok)
      .map((s) => ({ x: s.x, z: s.z, r: s.r, label: s.label, i: s.i, ok: () => true }));
    const o = {};
    for (const off of [0, 0.5, 1.0]) {
      for (let a = 0; a < 8; a++) {
        const th = (a / 8) * Math.PI * 2;
        const px = sx + off * Math.cos(th), pz = sz + off * Math.sin(th);
        for (let h = 0; h < 8; h++) {
          const yaw = (h / 8) * Math.PI * 2;
          const w = m.pickSpot(live, { x: px, z: pz, yaw, pitch: 0 }, 6);
          o[`${si}|${off}|${a}|${h}`] = w ? `${w.spot.i}:${w.spot.label}` : null;
        }
      }
    }
    return o;
  }, [st.x, st.z, st.i]);
  Object.assign(out, res);
  if (++n % 25 === 0) console.log(`  ${n}/${stations.length}`);
}

mkdirSync('shots', { recursive: true });
writeFileSync(OUT(MODE), JSON.stringify(out));
console.log(`wrote ${OUT(MODE)} — ${Object.keys(out).length} poses`);
await b.close();
