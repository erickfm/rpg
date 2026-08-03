// Item 265, step 2 — WHAT is standing at (6, −36.3)?
//
// Step 1 (`w105-stall-6-40.mjs`) reproduced the row's stall and found it is not
// a stall: holding W for 14 s from (6, −40) walks 3.7 m and then stops DEAD at
// z ≈ −36.3, 5/5, with no walker within 6 m on four of the five runs. So this
// is a static obstacle, not the give-way and not a citizen sealing the lane.
//
// This lists every collider whose box the player's 0.3 m radius would touch
// along that line, static and actor separately — `__ct.actorColliders()` is the
// set of moving boxes, so "is a citizen registered as static" (one of the row's
// candidates) is answerable rather than arguable.
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
const X = Number(process.env.AT_X ?? 6);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForFunction(() => (window.__ct.painted?.()?.triangles ?? 0) > 0, { timeout: 20000 });
// WARP OUT OF APARTMENT 301 FIRST (GOTCHAS 79b): the player spawns at x = 198,
// 98 m past the region-cull boundary, and a census taken there sees no exterior
// at all. Nothing below reads `visible`, but the walk-forward probe does need
// him outdoors and the colliders list is built per-frame.
await p.evaluate(() => window.__ct.warp(6, -40, Math.PI, 0, 0));
await p.waitForTimeout(400);

const out = await p.evaluate(([x]) => {
  const R = window.__ct.playerRadius();
  const actors = new Set(window.__ct.actorColliders());
  const hits = window.__ct.colliders()
    .filter((c) => c.minX - R <= x && x <= c.maxX + R && c.minZ > -46 && c.maxZ < -26)
    .map((c) => ({
      minX: +c.minX.toFixed(3), maxX: +c.maxX.toFixed(3),
      minZ: +c.minZ.toFixed(3), maxZ: +c.maxZ.toFixed(3),
      minY: c.minY ?? null, maxY: c.maxY ?? null,
      tag: c.tag ?? null, actor: actors.has(c),
      w: +(c.maxX - c.minX).toFixed(3), d: +(c.maxZ - c.minZ).toFixed(3),
    }))
    .sort((a, c) => a.minZ - c.minZ);
  return { R, hits, total: window.__ct.colliders().length, actorCount: actors.size };
}, [X]);

console.log(`\nplayer radius ${out.R}, ${out.total} colliders in the world (${out.actorCount} actors)`);
console.log(`boxes whose x-span reaches x = ${X} (± radius) between z −46 and −26:\n`);
console.log('   minX    maxX      minZ    maxZ       w × d      minY  maxY   actor  tag');
for (const h of out.hits) {
  console.log(`  ${String(h.minX).padStart(6)}  ${String(h.maxX).padStart(6)}   `
    + `${String(h.minZ).padStart(7)} ${String(h.maxZ).padStart(7)}   `
    + `${String(h.w).padStart(6)} × ${String(h.d).padStart(6)}  `
    + `${String(h.minY).padStart(5)} ${String(h.maxY).padStart(5)}   `
    + `${h.actor ? 'ACTOR' : '  -  '}  ${h.tag ?? ''}`);
}
if (!out.hits.length) console.log('  (none — the obstruction is not a collider on this line)');

// AND THE LANE: how wide is the walkable gap at each z across that stretch?
// The 2 m sidewalk lane is sacred, so the answer wanted is a WIDTH, not a
// yes/no. Swept in x from the kerb out to the shopfronts.
const lane = await p.evaluate(() => {
  const R = window.__ct.playerRadius();
  const rows = [];
  for (let z = -42; z <= -30; z += 0.5) {
    let open = 0, best = 0, run = 0;
    for (let x = -1; x <= 9; x += 0.05) {
      const blocked = window.__ct.colliders().some((c) =>
        x >= c.minX - R && x <= c.maxX + R && z >= c.minZ - R && z <= c.maxZ + R);
      if (blocked) { run = 0; } else { run += 0.05; if (run > best) best = run; open += 0.05; }
    }
    rows.push({ z: +z.toFixed(1), best: +best.toFixed(2), open: +open.toFixed(2) });
  }
  return rows;
});
console.log('\nwalkable lane, swept x −1 … 9 at 5 cm, player radius inflated:\n');
console.log('     z    widest continuous gap   total open');
for (const r of lane) {
  const flag = r.best < 2 ? '   ← under the 2 m lane' : '';
  console.log(`  ${String(r.z).padStart(5)}   ${r.best.toFixed(2).padStart(8)} m            ${r.open.toFixed(2).padStart(6)} m${flag}`);
}
await b.close();
