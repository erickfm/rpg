// ITEM 276 — "npcs still get stuck." PINNED, OR PARKED? MEASURE AND STOP.
//
// The item is explicit that this is a measurement, not a repair: if the answer
// is item 269's 1.15 m pinch, reopening 269 is the USER's decision. Nothing
// here writes to the world.
//
// THE DISTINCTION IS ALREADY PUBLISHED, so this does not have to infer it from
// a position trace. `ct/crowd.ts:239` says so in its own words: `wait` is the
// errand timer, `doing` the errand, `jam` the blocked-by-something timer.
//
//   wait > 0, jam ~ 0   -> PARKED. Standing on purpose, running an errand.
//                          A bus stop is a place where waiting is the point.
//   wait = 0, jam > 0   -> PINNED. Wants to move and cannot.
//
// JAM_GIVE_UP is 2.0 s (`ct/crowd.ts:564`), after which the walker REROUTES. So
// a genuine pin is not "jam climbs forever" -- it is jam sawtoothing 0..2 while
// the position never changes, i.e. rerouting and getting nowhere. A trace that
// only watches position cannot tell that from someone waiting for a bus, and
// that is exactly the confusion the item warns about.
//
// ⚠ WARP OUT OF THE FLAT FIRST. The player spawns in apartment 301 at x = 198,
// 98 m past the region cull, where a census of the street finds NOTHING
// (GOTCHAS 79b). Every reading below is taken standing on the pavement.
//
// WATCH LONG. The item says the crowd holds fixed lanes for about a minute, so
// a short sample reports clean on a real pin. Default window is 90 s.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w111-npc-stranded.mjs [seconds]
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { waitPainted } from '../lib/painted.mjs';
import { reportWorld } from '../lib/which-world.mjs';

const SECONDS = Number(process.argv[2] ?? 90);
const URL = aim('http://localhost:4672/');

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 740 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

// ── stand on the pavement by the bus stop, NOT in the flat ───────────────────
// The bench is the collider item 265/269 named; find it by its own extents
// rather than retyping them, and stand a few metres south of it on the walk.
// A WARP IS NOT A GUARANTEE, AND THIS RAN BOTH WAYS ON THIS PROBE. The first
// run landed on the pavement at (6.52, -44); the second, byte-identical, was
// still in the flat at (198.60, -16.30) and the 79b guard below stopped it. A
// single warp races the apartment's storey hysteresis, so: warp, WAIT FOR A
// PAINTED FRAME, check where you actually stand, and retry.
await waitPainted(p, { quiet: true });
let where = null;
for (let attempt = 1; attempt <= 6; attempt++) {
  await p.evaluate(() => window.__ct.warp(6.3, -44, 0, 0, 0));
  await waitPainted(p, { quiet: true });
  await p.waitForTimeout(300);
  where = await p.evaluate(() => window.__ct.pos());
  if (Math.hypot(where[0] - 6.3, where[2] + 44) < 2) break;
  console.log(`  warp attempt ${attempt} landed at (${where[0].toFixed(2)}, ${where[2].toFixed(2)}) — retrying`);
}
console.log(`standing at (${where[0].toFixed(2)}, ${where[2].toFixed(2)}) gy ${where[3]}`);
const cull = await p.evaluate(() => window.__ct.cullInfo());
console.log(`region cull: on=${cull.on} hidingExterior=${cull.hiding}`);
if (cull.hiding) { console.error('ABORT: the exterior is culled — this is GOTCHAS 79b, the census would be empty'); process.exit(3); }

// the bench, by extents, out of the world's own collider list
const bench = await p.evaluate(() => {
  const cs = window.__ct.staticColliders();
  let best = null;
  for (const c of cs) {
    // the bus-stop bench: ~0.66 x 1.84 m, centred near (5.4, -35)
    const w = c.maxX - c.minX, d = c.maxZ - c.minZ;
    if (w > 0.5 && w < 0.9 && d > 1.6 && d < 2.1 && c.minX > 4.5 && c.maxX < 6.5
      && c.minZ > -37 && c.maxZ < -33) best = c;
  }
  return { bench: best, radius: window.__ct.playerRadius() };
});
if (!bench.bench) console.log('  (no bench-shaped static collider matched — reporting positions raw)');
else {
  const bx = bench.bench.maxX;
  console.log(`bench collider  x ${bench.bench.minX.toFixed(3)}..${bx.toFixed(3)}`
    + `  z ${bench.bench.minZ.toFixed(3)}..${bench.bench.maxZ.toFixed(3)}`);
  console.log(`player radius ${bench.radius.toFixed(3)}  ->  furniture envelope edge `
    + `${(bx + bench.radius).toFixed(3)}`);
}

// ── WHERE IS HIS FRAME? SLEEP CENTER, out of the world ───────────────────────
// The item locates his frame by what is BEHIND the citizens. If SLEEP CENTER's
// frontage does not actually sit beside this bench, the desk has identified the
// wrong stretch and everything after that is measured in the wrong place.
const sleep = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  let mn = null, mx = null;
  s.traverse((n) => {
    const t = `${n.name || ''} ${JSON.stringify(n.userData || {})}`;
    if (!/SLEEP CENTER/i.test(t)) return;
    const g = n.geometry; if (!g) return;
    if (!g.boundingBox) g.computeBoundingBox();
    if (!g.boundingBox) return;
    const bb = g.boundingBox.clone().applyMatrix4(n.matrixWorld);
    if (!mn) { mn = { x: bb.min.x, z: bb.min.z }; mx = { x: bb.max.x, z: bb.max.z }; }
    mn.x = Math.min(mn.x, bb.min.x); mn.z = Math.min(mn.z, bb.min.z);
    mx.x = Math.max(mx.x, bb.max.x); mx.z = Math.max(mx.z, bb.max.z);
  });
  return mn ? { minX: mn.x, maxX: mx.x, minZ: mn.z, maxZ: mx.z } : null;
});
if (sleep) console.log(`SLEEP CENTER spans x ${sleep.minX.toFixed(1)}..${sleep.maxX.toFixed(1)}`
  + `  z ${sleep.minZ.toFixed(1)}..${sleep.maxZ.toFixed(1)}`
  + `   <- the bench at z ${bench.bench ? ((bench.bench.minZ + bench.bench.maxZ) / 2).toFixed(1) : '?'}`
  + ` is ${bench.bench && sleep.minZ <= bench.bench.maxZ && sleep.maxZ >= bench.bench.minZ ? 'BESIDE IT' : 'NOT beside it'}`);
else console.log('SLEEP CENTER: no mesh names it (it may be painted into a shared facade texture)');

// ── watch ────────────────────────────────────────────────────────────────────
console.log(`\nwatching ${SECONDS} s of walkers...`);
const t0 = Date.now();
const trace = new Map();          // index -> samples
let samples = 0;
while ((Date.now() - t0) / 1000 < SECONDS) {
  const w = await p.evaluate(() => window.__ct.walkers());
  w.forEach((k, i) => {
    if (!trace.has(i)) trace.set(i, []);
    trace.get(i).push({ t: (Date.now() - t0) / 1000, ...k });
  });
  samples++;
  await p.waitForTimeout(250);
}
console.log(`${samples} samples of ${trace.size} walkers over ${((Date.now() - t0) / 1000).toFixed(1)} s\n`);

const near = (k) => (bench.bench
  ? Math.hypot(k.x - (bench.bench.minX + bench.bench.maxX) / 2,
    k.z - (bench.bench.minZ + bench.bench.maxZ) / 2)
  : Infinity);

const rows = [];
for (const [i, s] of trace) {
  let moved = 0;
  for (let j = 1; j < s.length; j++) moved += Math.hypot(s[j].x - s[j - 1].x, s[j].z - s[j - 1].z);
  const span = Math.max(...s.map((k, j) => Math.hypot(k.x - s[0].x, k.z - s[0].z)));
  const maxJam = Math.max(...s.map((k) => k.jam));
  const jamAbove = s.filter((k) => k.jam > 0.5).length / s.length;
  const waiting = s.filter((k) => k.wait > 0).length / s.length;
  const acts = [...new Set(s.map((k) => k.doing))].join(',');
  const last = s[s.length - 1];
  const minNear = Math.min(...s.map(near));
  rows.push({ i, moved, span, maxJam, jamAbove, waiting, acts, last, minNear,
    ghost: s.some((k) => k.ghost) });
}
rows.sort((a, c) => a.moved - c.moved);

console.log('idx   path(m)  span(m)  maxJam  jam>0.5  wait>0   doing                 nearest-bench  last (x,z)');
for (const r of rows) {
  console.log(`${String(r.i).padStart(3)} ${r.moved.toFixed(2).padStart(9)} ${r.span.toFixed(2).padStart(8)}`
    + ` ${r.maxJam.toFixed(2).padStart(7)} ${(r.jamAbove * 100).toFixed(0).padStart(7)}%`
    + ` ${(r.waiting * 100).toFixed(0).padStart(6)}%  ${r.acts.padEnd(22)}`
    + ` ${(r.minNear === Infinity ? '-' : r.minNear.toFixed(2)).padStart(12)}`
    + `  (${r.last.x.toFixed(2)}, ${r.last.z.toFixed(2)})${r.ghost ? '  GHOST' : ''}`);
}

// ── the verdict, per the item's own definition ───────────────────────────────
// STATIONARY: travelled less than one body-length over the whole window.
const STILL = 0.5;
const still = rows.filter((r) => r.moved < STILL);
console.log(`\n${still.length} of ${rows.length} walkers travelled < ${STILL} m in ${SECONDS} s`);
for (const r of still) {
  // PINNED = wants to move (not on an errand timer) and is blocked (jam).
  const pinned = r.waiting < 0.5 && r.maxJam > 0.5;
  const parked = r.waiting >= 0.5;
  console.log(`  walker ${r.i} at (${r.last.x.toFixed(2)}, ${r.last.z.toFixed(2)}): `
    + `${pinned ? 'PINNED' : parked ? 'PARKED (errand timer running)' : 'STILL, but neither jammed nor waiting'}`
    + `  — wait>0 for ${(r.waiting * 100).toFixed(0)}% of samples, max jam ${r.maxJam.toFixed(2)}`
    + ` (JAM_GIVE_UP is 2.0), doing "${r.acts}"`);
}
if (!still.length) console.log('  nobody was stationary in this window.');

// ── STATIONARY EPISODES, WHICH IS THE ACTUAL QUESTION ────────────────────────
// Total path over a 240 s window washes out exactly what the user photographed:
// a citizen who walks 100 m and stands still for 20 s of it scores as "moving".
// His frame is ONE MOMENT. So find the episodes.
//
// `ct/crowd.ts:637` authors standing still on purpose, and one of the errands is
// the bus stop itself:
//     bench:  [12, 25]   "wait for the 42"
//     window: [ 5, 12]   "stop and look in"
//     door:   [ 4,  8]   "hesitate in a doorway"
// So an episode of 12-25 s at the bench is not a bug, it is the feature.
const EPS = 0.02;                       // m of movement between samples = "still"
console.log('\nSTATIONARY EPISODES (>= 2 s of not moving):');
console.log('  idx   from      dur    doing      maxJam   wait@start   where (x,z)      dist to bench');
const episodes = [];
for (const [i, s] of trace) {
  let j = 0;
  while (j < s.length) {
    if (Math.hypot(s[j].x - s[Math.max(0, j - 1)].x, s[j].z - s[Math.max(0, j - 1)].z) > EPS || j === 0) { j++; continue; }
    const st = j - 1;
    while (j < s.length && Math.hypot(s[j].x - s[j - 1].x, s[j].z - s[j - 1].z) <= EPS) j++;
    const dur = s[j - 1].t - s[st].t;
    if (dur >= 2) {
      const seg = s.slice(st, j);
      episodes.push({ i, t: s[st].t, dur, doing: s[st].doing,
        maxJam: Math.max(...seg.map((k) => k.jam)), wait: s[st].wait,
        x: s[st].x, z: s[st].z, near: near(s[st]) });
    }
  }
}
episodes.sort((a, c) => c.dur - a.dur);
for (const e of episodes.slice(0, 20))
  console.log(`  ${String(e.i).padStart(3)} ${e.t.toFixed(1).padStart(7)}s ${e.dur.toFixed(1).padStart(7)}s`
    + `  ${e.doing.padEnd(9)} ${e.maxJam.toFixed(2).padStart(7)} ${e.wait.toFixed(2).padStart(11)}`
    + `   (${e.x.toFixed(2)}, ${e.z.toFixed(2)})`.padEnd(20)
    + ` ${(e.near === Infinity ? '-' : e.near.toFixed(2)).padStart(10)}`);
console.log(`  ${episodes.length} episodes total; longest ${episodes.length ? episodes[0].dur.toFixed(1) : 0} s`);

// THE CLASSIFICATION THE ITEM ASKS FOR, over episodes rather than over walkers.
const pinnedEps = episodes.filter((e) => e.wait <= 0 && e.maxJam > 0.5);
const parkedEps = episodes.filter((e) => e.wait > 0);
console.log(`  PARKED (errand timer running): ${parkedEps.length}`);
console.log(`  PINNED  (no errand, jam > 0.5): ${pinnedEps.length}`);
for (const e of pinnedEps.slice(0, 10))
  console.log(`    *** PINNED *** walker ${e.i} at (${e.x.toFixed(2)}, ${e.z.toFixed(2)}) for ${e.dur.toFixed(1)} s, jam ${e.maxJam.toFixed(2)}`);
const byDoing = new Map();
for (const e of episodes) byDoing.set(e.doing, (byDoing.get(e.doing) || 0) + 1);
console.log(`  episodes by errand: ${[...byDoing].map(([k, n]) => `${k}=${n}`).join(' ')}`);

// DOES THE 'bench' ERRAND EXIST IN THIS WORLD AT ALL? If the route net has no
// bench node, then "waiting for the 42" cannot be the explanation and the
// standing citizens must be something else.
const benchNodes = await p.evaluate(() => {
  const w = window.__ct.walkers();
  return { acts: [...new Set(w.map((k) => k.doing))] };
});
console.log(`  errands visible on __ct.walkers() right now: ${benchNodes.acts.join(', ')}`);

// ── DOES ANYBODY EVEN GO THROUGH THE PINCH? ──────────────────────────────────
// This is the question that decides the whole item. If the crowd never routes
// over z −35.8…−34.3 on the east walk, then 269's pinch cannot be what is
// stranding them, however real the 1.15 m is. "Nobody got stuck" over a window
// in which nobody was EXPOSED is not evidence of anything -- it is the vacuous
// pass this project keeps paying for.
const PINCH = { z0: -35.8, z1: -34.3, x0: 4.5, x1: 7.0 };
let visits = 0, visitors = new Set(), inside = 0;
const lanes = new Map();
for (const [i, s] of trace) {
  let was = false;
  for (const k of s) {
    lanes.set(k.x.toFixed(2), (lanes.get(k.x.toFixed(2)) || 0) + 1);
    const here = k.z >= PINCH.z0 && k.z <= PINCH.z1 && k.x >= PINCH.x0 && k.x <= PINCH.x1;
    if (here) { inside++; visitors.add(i); if (!was) visits++; }
    was = here;
  }
}
console.log(`\nTHE PINCH (east walk, z ${PINCH.z0}..${PINCH.z1}, the 1.15 m stretch):`);
console.log(`  ${visits} entries by ${visitors.size} distinct walkers; ${inside} of `
  + `${[...trace.values()].reduce((a, s) => a + s.length, 0)} samples were inside it`);
// WHERE ON THE BLOCK DOES THE CROWD ACTUALLY SPEND ITS TIME? This is the
// honest alternative explanation for both "nobody was pinned at the bench" and
// "the bench errand never fired": they may simply not go up there. A zero
// measured over a region nobody visits is not evidence about that region.
const zs = [];
for (const s of trace.values()) for (const k of s) zs.push(k.z);
zs.sort((a, c) => a - c);
const q = (f) => zs[Math.floor(f * (zs.length - 1))].toFixed(1);
const northOfBench = zs.filter((z) => z > -36.6).length / zs.length;
console.log(`\n  crowd z distribution: min ${q(0)}  p25 ${q(0.25)}  median ${q(0.5)}`
  + `  p75 ${q(0.75)}  max ${q(1)}`);
console.log(`  ${(northOfBench * 100).toFixed(1)}% of samples were NORTH of the bench node (z > -36.6)`);
console.log('  lanes the crowd actually walks (x, by sample count):');
for (const [x, n] of [...lanes].sort((a, c) => c[1] - a[1]).slice(0, 10))
  console.log(`    x ${x}  ${n}`);

await b.close();
