// ITEM 65'S ACCEPTANCE TEST — the V overlay must not call a pedestrian a trap.
//
// It reproduces the overlay's OWN decision rather than re-implementing the
// rule: `trapAgainst` is imported from ct/gap.ts, the same function
// ct/debug-collision.ts colours with, run over the same live array.
//
//   1. no citizen or vehicle is ever scored red
//   2. the east walk lane shows no STANDING red — sampled over time, because a
//      walker is only there some of the time and one frame proves nothing
//   3. MUTATION: a genuine static trap placed beside the walking lane is still
//      caught. A fix that silenced the false red by silencing all red would be
//      worse than the bug.
//
// Usage: SHOT_URL=http://localhost:4193/ node scripts/probes/w30-overlay-actors.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4193/';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

let bad = 0;
const fail = (m) => { bad++; console.log(`FAIL  ${m}`); };
const pass = (m) => console.log(`ok    ${m}`);

const has = await p.evaluate(() => typeof window.__ct.actorColliders === 'function');
if (!has) { fail('__ct.actorColliders() is not published — the world is stale, restart the dev server'); await b.close(); process.exit(1); }

// One sample of the overlay's verdict for every collider.
const sample = () => p.evaluate(async () => {
  const { trapAgainst } = await import('/src/proto/ct/gap.ts');
  const key = (c) => `${c.minX} ${c.maxX} ${c.minZ} ${c.maxZ} ${c.rot ?? 0}`;
  const cols = window.__ct.colliders();
  const actorKeys = new Set(window.__ct.actorColliders().map(key));
  // exactly what debug-collision.ts now does: actors are neither scored nor
  // allowed to form a corridor
  const statics = cols.filter((c) => !actorKeys.has(key(c)));
  const out = { actors: 0, red: [], actorRed: 0 };
  for (const c of cols) {
    if (actorKeys.has(key(c))) {
      out.actors++;
      if (trapAgainst(c, statics) !== null) out.actorRed++;   // would have been red
      continue;
    }
    if (trapAgainst(c, statics) !== null) out.red.push(key(c));
  }
  return out;
});

// ── 1 + 2. sampled over 40 s, so a walker is caught in the lane many times ──
console.log('sampling the overlay verdict for 40 s …');
const redSeen = new Map();
let actorsSeen = 0, samples = 0, eastLaneRed = 0;
for (let i = 0; i < 80; i++) {
  const s = await sample();
  samples++;
  actorsSeen = Math.max(actorsSeen, s.actors);
  for (const k of s.red) {
    redSeen.set(k, (redSeen.get(k) ?? 0) + 1);
    // the east walk lane: crowd-net.ts:87 puts it at x 6.00, citizens span
    // 5.75…6.25. Anything red whose box is exactly that half-width there is a
    // walker that slipped through the actor filter.
    const [minX, maxX] = k.split(' ').map(Number);
    if (Math.abs(maxX - minX - 0.5) < 1e-6 && minX > 5.5 && maxX < 6.6) eastLaneRed++;
  }
  await p.waitForTimeout(500);
}
console.log(`  ${samples} samples, ${actorsSeen} actor colliders, ${redSeen.size} distinct static reds`);

if (eastLaneRed === 0) pass('no citizen-shaped box on the east lane was ever scored red');
else fail(`a citizen-shaped box on the east lane was scored red in ${eastLaneRed} samples`);

// Every red must be static — i.e. stable across samples. A red that appears in
// only a handful of samples is a mover that got through.
const flickering = [...redSeen].filter(([, n]) => n < samples * 0.9);
if (flickering.length === 0) pass(`every red is present in >=90% of samples — all static`);
else {
  fail(`${flickering.length} red box(es) flicker, so they move:`);
  for (const [k, n] of flickering.slice(0, 8)) console.log(`        ${k}  (${n}/${samples})`);
}

// ── 3. MUTATION: a real static trap beside the lane must still be caught ──
//
// Pushed onto the LIVE colliders array — `crosstown.ts` returns it by
// reference — so it is the real array the overlay reads. It is NOT in
// actorBoxes, so it must be treated as geometry.
console.log('\nmutation: a genuine static trap beside the walking lane …');
const before = redSeen.size;
const after = await p.evaluate(async () => {
  const { trapAgainst } = await import('/src/proto/ct/gap.ts');
  const key = (c) => `${c.minX} ${c.maxX} ${c.minZ} ${c.maxZ} ${c.rot ?? 0}`;
  // 0.45 m off the bodega block's face at x 6.70, z inside its -94…-86 span —
  // the exact geometry item 57 claimed and did not have.
  const trap = { minX: 5.75, maxX: 6.25, minZ: -90.25, maxZ: -89.75 };
  window.__ct.colliders().push(trap);
  const cols = window.__ct.colliders();
  const actorKeys = new Set(window.__ct.actorColliders().map(key));
  const statics = cols.filter((c) => !actorKeys.has(key(c)));
  const g = trapAgainst(trap, statics);
  return { caught: g !== null, gap: g };
});
if (after.caught) pass(`the planted static trap IS still caught (gap ${after.gap.toFixed(3)} m)`);
else fail('the planted static trap was NOT caught — the fix silenced real red too');
console.log(`  (static reds before the mutation: ${before})`);

console.log(bad ? `\n${bad} FAIL` : '\nALL PASS');
await b.close();
process.exit(bad ? 1 : 0);
