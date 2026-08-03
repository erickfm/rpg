// BLAST RADIUS of a change to pickSpot's tiering, over the whole world.
//
// `fp.ts` is the highest-risk file in the project, so before/after here is not
// "the two cases I care about" — it is every registered [E] in the world, from
// a ring of stand-offs, at eight headings each. ~200 spots x 3 offsets x 8
// headings, and the winning label recorded for each.
//
// IT CALLS THE WORLD'S OWN pickSpot — through `__ct.pickSpot()` (item 237), so
// this is the real resolver and not a model of it. A model would go stale the
// moment I edited the thing it models, which is the whole point of running it.
//
// ── IT USED TO REACH IT THE ONE WAY THAT DOES NOT WORK ON THE BUNDLE ─────────
// This did `await import('/src/proto/fp.ts')` in the page. `vite dev` serves
// that path; `vite preview` 404s it, and with no try/catch the probe threw
// `Failed to fetch dynamically imported module` at its first station. So the
// blast-radius differ for the highest-risk file in the project — the one
// instrument that says whether a selection change moved the world — could not
// be pointed at the world the user actually ships (GOTCHAS 28). `__ct.pickSpot`
// calls the same `pickSpot` over the same live `SPOTS` and returns the winner's
// index and label as numbers and strings, which is all this differ ever keyed
// on.
//
// The `visible` callback is deliberately NOT supplied: it is a FILTER applied
// before any tiering and I am not touching it, so leaving it out widens the
// candidate set (making the diff more sensitive, not less) without changing
// what is being compared. Live-prompt truth is checked separately by
// w40-bed-vs-door.mjs; this is a differ, not an oracle. The hook cannot supply
// it either, and for a stronger reason — `update()`'s raycast starts at the
// PLAYER'S eye, and every pose below is one the player is not standing in.
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
  // A CHANGE OF INDEX IS NOT A CHANGE THE PLAYER CAN SEE. The casino has ~70
  // identically-labelled "sit at the slot" spots in a dense grid; swapping
  // which one a pose resolves to alters no prompt and no outcome, so it is
  // counted apart from changes that actually rename what [E] offers.
  const lbl = (v) => (v == null ? '(none)' : v.slice(v.indexOf(':') + 1));
  const renamed = changed.filter((k) => lbl(a[k]) !== lbl(c[k]));
  const nulled = changed.filter((k) => c[k] == null && a[k] != null);
  const gained = changed.filter((k) => a[k] == null && c[k] != null);
  console.log(`${keys.length} poses; ${changed.length} changed (${(100 * changed.length / keys.length).toFixed(1)}%)`);
  console.log(`  of those, ${changed.length - renamed.length} are same-label index swaps (invisible to the player)`);
  console.log(`  ${renamed.length} change the PROMPT TEXT (${(100 * renamed.length / keys.length).toFixed(2)}% of all poses)`);
  console.log(`  ${nulled.length} poses lost their offer entirely; ${gained.length} gained one\n`);
  const buckets = new Map();
  for (const k of renamed) {
    const sig = `${lbl(a[k])}  ->  ${lbl(c[k])}`;
    if (!buckets.has(sig)) buckets.set(sig, []);
    buckets.get(sig).push(k);
  }
  for (const [sig, ks] of [...buckets].sort((x, y) => y[1].length - x[1].length)) {
    console.log(`  ${String(ks.length).padStart(4)}x  ${sig}`);
    console.log(`         e.g. ${ks[0]}`);
  }
  // DID ANYTHING BECOME UNREACHABLE? Reordering which of several competing
  // offers wins is the point; making a spot that used to be winnable from
  // somewhere winnable from nowhere would be a real defect, and it is invisible
  // in the per-pose counts above because every one of those poses still offers
  // SOMETHING. Compare the SET of spots that win at least one pose.
  const winners = (m) => new Set(Object.values(m).filter(Boolean).map((v) => v.split(':')[0]));
  const wb = winners(a), wc = winners(c);
  const lost = [...wb].filter((s) => !wc.has(s));
  const won = [...wc].filter((s) => !wb.has(s));
  console.log(`\nspots winnable from at least one pose: ${wb.size} before, ${wc.size} after`);
  const name = (idx) => {
    for (const k of keys) { const v = c[k] ?? a[k]; if (v && v.split(':')[0] === idx) return v.slice(v.indexOf(':') + 1); }
    return '?';
  };
  if (lost.length) {
    console.log(`  UNREACHABLE NOW (${lost.length}):`);
    for (const s of lost) console.log(`    ${s}: ${name(s)}`);
  } else console.log('  none became unreachable');
  if (won.length) {
    console.log(`  newly reachable (${won.length}):`);
    for (const s of won) console.log(`    ${s}: ${name(s)}`);
  }
  process.exit(lost.length ? 1 : 0);
}

const URL = aim('http://localhost:4188/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.waitForTimeout(2000);
await reportWorld(p, URL);

// GOTCHAS 32: without the hook this measures nothing, and a differ that reports
// "0 changed" because it visited no poses is the worst possible reading.
if (await p.evaluate(() => typeof window.__ct.pickSpot) !== 'function') {
  console.error('ABORT: __ct.pickSpot is not published on this world — nothing was measured.');
  await b.close(); process.exit(3);
}

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
  const res = await p.evaluate(([sx, sz, si]) => {
    // The hook resolves against the world's own live SPOTS with their own
    // `ok()`. That is what the hand-built `live` list above was reconstructing:
    // it filtered on `ok` and then flattened every predicate to `() => true`,
    // which is the same candidate set for as long as the player does not move —
    // and the player is warped once per station, before this call, precisely so
    // the room's predicates are live. One fewer copy of the world to keep true.
    const o = {};
    for (const off of [0, 0.5, 1.0]) {
      for (let a = 0; a < 8; a++) {
        const th = (a / 8) * Math.PI * 2;
        const px = sx + off * Math.cos(th), pz = sz + off * Math.sin(th);
        for (let h = 0; h < 8; h++) {
          const yaw = (h / 8) * Math.PI * 2;
          const w = window.__ct.pickSpot({ x: px, z: pz, yaw, pitch: 0 }, { reach: 6 });
          o[`${si}|${off}|${a}|${h}`] = w ? `${w.index}:${w.label}` : null;
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
