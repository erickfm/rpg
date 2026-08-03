// ITEM 260 (3/4) — WHICH "STATIC" COLLIDERS ACTUALLY MOVE?
//
// `crosstown.ts:1559` defines `staticColliders()` as *everything not in
// `actorBoxes`*, and `actorBoxes` is populated by exactly two registrars —
// `ctx.vehicleBox` and `ctx.solid`. **Anything pushed into `colliders` by some
// other route is "static" by default**, whether or not it moves. That is the
// GOTCHAS 73 class: an actor registering itself as furniture.
//
// It nearly cost worker onehundredfour a false finding — raw collider counts
// read 257/258/259 across a round trip and they almost filed *"ghosts.mjs is
// culled"* before noticing the counts were MONOTONIC, i.e. actors spawning
// rather than anything being culled.
//
// So: read `staticColliders()` twice, with the sim running in between, and
// report every box whose numbers changed. Identity by INDEX is useless (the
// list grows), so boxes are matched on their SIZE, which does not change even
// when the position does — a moving box keeps its dimensions.
//
// Usage: SHOT_URL=http://localhost:4191/ node scripts/probes/w101-moving-static.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';

const URL = aim('http://localhost:4191/');
const WAIT = Number(process.env.WAIT ?? 4000);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct && window.__ct.staticColliders, null, { timeout: 60000 });
await p.waitForTimeout(1500);

const read = () => p.evaluate(() => window.__ct.staticColliders().map((c) => ({
  x: +((c.minX + c.maxX) / 2).toFixed(4), z: +((c.minZ + c.maxZ) / 2).toFixed(4),
  w: +(c.maxX - c.minX).toFixed(4), d: +(c.maxZ - c.minZ).toFixed(4),
})));

// ⚠ STAND IN 301 FIRST. The first run of this read 525 boxes twice and found
// NOTHING MOVING — because the region culler hides every unentered interior
// (item 141) and the actors inside one do not tick. Reading from the default
// street spawn asks the question of a building nobody is in, and gets a clean
// answer to a question nobody asked. `ct/apartment.ts` publishes
// `scene.userData.spawn` — the player's own flat — precisely so a check can get
// there without typing three coordinates.
const spawn = await p.evaluate(() => window.__ct.scene()?.userData?.spawn ?? null);
if (!spawn) { console.log('ABORT no scene.userData.spawn — cannot reach 301 (GOTCHAS §32)'); await b.close(); process.exit(3); }
await p.evaluate((s) => window.__ct.warp(s.x, s.z, 0, s.gy, 0), spawn);
await p.waitForTimeout(1500);
console.log(`standing in 301 at (${spawn.x.toFixed(2)}, ${spawn.z.toFixed(2)}), storey ${spawn.gy}`);

const a = await read();
await p.waitForTimeout(WAIT);
const c = await read();
console.log(`staticColliders(): ${a.length} then ${c.length}`
  + (c.length !== a.length ? `   <-- the list itself GREW by ${c.length - a.length}` : ''));

// Group by size; within a size, a box that appears at a different (x, z) in the
// second reading and not the first has MOVED. Parked caps (999 / 9999) are the
// project's own idiom for "switched off" and move on purpose — reported apart.
const key = (o) => `${o.w}x${o.d}`;
const bag = (rows) => {
  const m = new Map();
  for (const r of rows) { if (!m.has(key(r))) m.set(key(r), []); m.get(key(r)).push(`${r.x},${r.z}`); }
  return m;
};
const A = bag(a), C = bag(c);
const parked = (s) => /(^|,)9{3,}/.test(s);

const moved = [];
for (const [k, before] of A) {
  const after = C.get(k) ?? [];
  const gone = before.filter((s) => !after.includes(s));
  const came = after.filter((s) => !before.includes(s));
  if (gone.length || came.length) moved.push({ size: k, gone, came });
}
console.log(`\n${moved.length} SIZE-GROUPS whose members changed position between readings:\n`);
for (const m of moved) {
  const cap = [...m.gone, ...m.came].some(parked);
  console.log(`  ${m.size} m${cap ? '   (a PARKED cap — 999/9999 is the "switched off" idiom, moves on purpose)' : ''}`);
  for (const s of m.gone.slice(0, 4)) console.log(`      was at ${s}`);
  for (const s of m.came.slice(0, 4)) console.log(`      now at ${s}`);
}
const real = moved.filter((m) => ![...m.gone, ...m.came].some(parked));
console.log(`\n${real.length} of those are NOT parked caps — an actor on the static list:`);
for (const m of real) console.log(`  ${m.size} m  ${m.gone[0] ?? '?'} -> ${m.came[0] ?? '?'}`);
await b.close();
process.exit(real.length ? 1 : 0);
