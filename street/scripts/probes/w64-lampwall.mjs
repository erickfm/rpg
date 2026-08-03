// w64: where are the lamps, and what big facades stand near them?
//
// ── STATUS: ITEM 156 IS DONE, AND THIS PROBE DID NOT SOLVE IT ───────────────
//
// This was written for item 156 — the user's *"whats going on here with the
// light reflecting against the invisible wall?"* — to test the desk's
// hypothesis that the edge was a REGISTRATION GAP between two materials of one
// wall. That hypothesis was wrong. The cause was a radial gradient that
// overflowed its own canvas: `ct/props.ts`'s `wallSplashT` called
// `createRadialGradient(16, 17, 1, 16, 17, 26)` on a canvas 32 px wide, so the
// falloff never reached zero before the texture ran out and an additive
// 3.4 x 5.0 m quad ended mid-ramp — a straight vertical edge of light down
// brick. See `notes/eightyseven-item156-invisible-wall.md`.
//
// WHAT ACTUALLY MEASURED IT, and what you should reach for instead if a night
// lighting edge is ever reported again — the method is night ÷ day at one fixed
// camera, which cancels the texture and leaves only the lighting:
//
//     scripts/probes/w87-item156-lightedge.mjs   sweeps facade stations
//     scripts/probes/w87-item156-ratiomap.mjs    draws the lighting field
//     scripts/probes/w87-item156-whichmesh.mjs   names the offending mesh
//
// ── REPAIRED 2026-08-03, item 246 (worker ninetythree) ─────────────────────
//
// It was left aimed at a world that is not there. Three faults, and the one the
// queue row named turned out to be the harmless one — measured, not argued:
//
// 1. **IT NEVER MOVED THE PLAYER, AND THE WORLD IS REGION-CULLED.** The default
//    spawn is `x 198.6, z −16.3` — INSIDE apartment 301, out in the interior
//    belt. `__ct.cullInfo()` reports `on: true, hiding: true` there, and
//    **3,497 meshes with x < 100 — the entire street, every lamp, every facade
//    — carry `visible === false`.** This probe's own parent-visibility filter
//    then dropped all of them. What it printed as "tall meshes near the lamps"
//    was the walk-up's INTERIOR shell, 160 m from the nearest lamp head.
//
//    **And it produced evidence FOR the wrong hypothesis.** Every wall it found
//    printed `pooled=false`, which reads exactly like the registration gap the
//    desk suspected. Standing on the street instead: **2,233 of 2,496 meshes
//    within 12 m of a lamp head (89.5%) are pooled.** The `false` column was an
//    artefact of measuring an empty street. A probe that answers the question
//    you asked, wrongly, is worse than one that answers nothing.
//
// 2. **`ud.lampList` / `ud.lamps` DO NOT EXIST**, so the `lamps:` line printed
//    `null` on every run this probe has ever had. `scene.userData` publishes
//    `addLamp` (a REGISTRAR — it takes x/z and returns a remover) plus the two
//    counters `lampHeadCount` and `lampHeadsUploaded`. There is no world-facing
//    list of head positions at all. The heads are findable from the SCENE
//    though: `ct/props.ts:1924` tags each one `userData.lampPart = 'head'`.
//    That is what this reads now, and it cross-checks the geometric count
//    against the registry's own counter rather than trusting either alone.
//
// 3. **`if (bb.min.x > 300) return` — the line the row blamed — DROPS NOTHING.**
//    All 21 tagged lamp heads stand between x −34.8 and x +45. A cut at 300
//    could never have excluded one. It has been replaced anyway, not because it
//    was wrong but because a typed coordinate cannot state its own intent: the
//    facade window is now DERIVED from where the lamps actually are.
//
//    The cut that really blinded it, after the culling, was **`h < 6`**. Even
//    with the street visible there are 94 meshes ≥6 m near a lamp, but the
//    threshold is now declared and lowered to 3 m, because a shopfront pier is
//    not 6 m tall and the splash quad it carries is 5.0 m.
//
// Usage: SHOT_URL=http://localhost:4490/ node scripts/probes/w64-lampwall.mjs
//        --selftest  re-runs the measurement at the default spawn, which must
//                    find nothing — the negative control for fault 1.
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL || 'http://localhost:4490/';
const SELFTEST = process.argv.includes('--selftest');

// DECLARED, not typed inline. A facade near a lamp is what this probe is about,
// so both numbers belong at the top where they can be argued with.
const NEAR_M = 12;      // "stands near a lamp": horizontal metres from a head
const TALL_M = 3;       // "a big facade": metres of mesh height
// Population floors. Every verdict below is about a set; all of them are free
// at zero, and this probe has already shipped one conclusion drawn from an
// empty street. (GOTCHAS 34.)
const MIN_HEADS = 10;
const MIN_FACADES = 20;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1064, height: 796 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });

// ── PASS 1: where are the lamps? ───────────────────────────────────────────
// Read BEFORE moving, and deliberately WITHOUT the visibility filter: a culled
// mesh is still in the graph, so the head positions are readable from anywhere.
// That is what makes the station derivable instead of typed.
//
// NIGHT FIRST, AND WAIT. `lampHeadCount`/`lampHeadsUploaded` are written by
// `updateLit` once per frame (`ct/props.ts:1409`) — read them off a page that
// has only just loaded and both come back `null`, which is indistinguishable
// from "the registry is gone". Half a second of clock is the difference between
// `27` and a false alarm.
await p.evaluate(() => window.__ct.clock(22, 30));
await p.waitForTimeout(800);
const lamps = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const heads = [];
  s.traverse((o) => {
    if (o.userData?.lampPart !== 'head') return;
    const e = o.matrixWorld.elements;
    let hidden = false;
    for (let q = o; q; q = q.parent) if (q.visible === false) { hidden = true; break; }
    heads.push({ x: e[12], y: e[13], z: e[14], hidden });
  });
  return {
    heads,
    registered: s.userData.lampHeadCount ?? null,
    uploaded: s.userData.lampHeadsUploaded ?? null,
    spawn: window.__ct.pos(),
    cull: window.__ct.cullInfo ? window.__ct.cullInfo() : null,
  };
});

console.log(`spawn: x ${lamps.spawn[0].toFixed(1)} z ${lamps.spawn[2].toFixed(1)}`
  + `   culling ${lamps.cull ? `on=${lamps.cull.on} hiding=${lamps.cull.hiding}` : 'unknown'}`);
console.log(`lamp heads tagged \`lampPart:'head'\` in the scene: ${lamps.heads.length}`
  + `   (${lamps.heads.filter((h) => h.hidden).length} of them culled from where we stand now)`);
console.log(`scene.userData.lampHeadCount = ${lamps.registered}`
  + `   lampHeadsUploaded = ${lamps.uploaded}  (POOL_MAX caps the upload at 12)`);
if (lamps.registered != null && lamps.registered !== lamps.heads.length) {
  // Not an error: `addLamp` is open to any module, and a light with no visible
  // fitting — an interior, a sign, a television — registers a head and tags no
  // mesh. Said out loud so nobody reads the gap as a lost lamp.
  console.log(`  note  ${lamps.registered - lamps.heads.length} registered head(s) have no `
    + `\`lampPart\` mesh — modules may call addLamp() without building a fitting`);
}
if (lamps.heads.length < MIN_HEADS) {
  console.error(`POPULATION FLOOR: ${lamps.heads.length} lamp heads, want >= ${MIN_HEADS}. Nothing measured.`);
  await b.close(); process.exit(3);
}

// The station: the centroid of the head cluster, which is the street. DERIVED —
// the old `x > 300` was a typed guess at the same thing and could not say so.
const cx = lamps.heads.reduce((a, h) => a + h.x, 0) / lamps.heads.length;
const cz = lamps.heads.reduce((a, h) => a + h.z, 0) / lamps.heads.length;
const xs = lamps.heads.map((h) => h.x), zs = lamps.heads.map((h) => h.z);
console.log(`lamp cluster: x ${Math.min(...xs).toFixed(1)}…${Math.max(...xs).toFixed(1)}`
  + `  z ${Math.min(...zs).toFixed(1)}…${Math.max(...zs).toFixed(1)}`
  + `   centroid (${cx.toFixed(1)}, ${cz.toFixed(1)})`);

// ── PASS 2: stand there, at night, and look at what the lamps light ────────
if (!SELFTEST) await p.evaluate(([x, z]) => window.__ct.warp(x, z), [cx, cz]);
else console.log('\n[--selftest] NOT warping: measuring from the default spawn, which must find nothing');
await p.evaluate(() => window.__ct.clock(22, 30));
await p.waitForTimeout(1500);       // let the culler re-classify and the grade settle

const out = await p.evaluate(([near, tall]) => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const heads = [];
  s.traverse((o) => {
    if (o.userData?.lampPart !== 'head') return;
    const e = o.matrixWorld.elements; heads.push({ x: e[12], z: e[14] });
  });
  const walls = [];
  let visNear = 0, pooledNear = 0, hiddenTotal = 0;
  s.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    for (let q = o; q; q = q.parent) if (q.visible === false) { hiddenTotal++; return; }
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); if (!g.boundingBox) return;
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const mx = (bb.min.x + bb.max.x) / 2, mz = (bb.min.z + bb.max.z) / 2;
    let d = Infinity;
    for (const h of heads) { const t = Math.hypot(mx - h.x, mz - h.z); if (t < d) d = t; }
    if (d > near) return;
    const mm = Array.isArray(o.material) ? o.material : [o.material];
    const pooled = mm.map((m) => !!(m && m.customProgramCacheKey && m.customProgramCacheKey() === 'w45pool'));
    visNear++; if (pooled.some(Boolean)) pooledNear++;
    const h = bb.max.y - bb.min.y;
    if (h < tall) return;
    walls.push({ h: +h.toFixed(2), d: +d.toFixed(1),
      x0: +bb.min.x.toFixed(2), x1: +bb.max.x.toFixed(2),
      z0: +bb.min.z.toFixed(2), z1: +bb.max.z.toFixed(2),
      y0: +bb.min.y.toFixed(2), y1: +bb.max.y.toFixed(2),
      mod: o.userData?.mod ?? o.parent?.userData?.mod ?? '?',
      nMat: mm.length, pooled,
      col: mm.map((m) => (m && m.color ? '#' + m.color.getHexString() : null)) });
  });
  return { nHeads: heads.length, visNear, pooledNear, hiddenTotal, walls };
}, [NEAR_M, TALL_M]);

console.log(`\n${SELFTEST ? 'standing at the SPAWN' : 'standing on the street'}: `
  + `${out.hiddenTotal} meshes still culled`);
console.log(`within ${NEAR_M} m of a lamp head: ${out.visNear} visible meshes, `
  + `${out.pooledNear} carrying the per-fragment pool `
  + `(${out.visNear ? (100 * out.pooledNear / out.visNear).toFixed(1) : '—'}%)`);
console.log(`of those, ${out.walls.length} stand >= ${TALL_M} m tall:`);
for (const w of out.walls.sort((a, c) => a.d - c.d).slice(0, 40)) {
  console.log(`  ${String(w.h).padStart(6)}m  ${String(w.d).padStart(5)}m from a lamp  `
    + `x[${w.x0},${w.x1}] z[${w.z0},${w.z1}] y[${w.y0},${w.y1}] `
    + `mod=${w.mod} mats=${w.nMat} pooled=${w.pooled} ${w.col}`);
}
if (out.walls.length > 40) console.log(`  … and ${out.walls.length - 40} more`);

if (SELFTEST) {
  // THE NEGATIVE CONTROL. At the spawn the street is culled, so this must come
  // back empty. If it does not, culling is off or the spawn moved, and the
  // headline claim in this file's header no longer describes the world.
  const ok = out.visNear === 0;
  console.log(`\nSELFTEST: from the spawn, ${out.visNear} visible meshes near a lamp `
    + `— ${ok ? 'PASS, the street is culled exactly as the header says'
             : '*** FAIL: the street is NOT culled at the spawn; re-check fault 1 ***'}`);
  await b.close(); process.exit(ok ? 0 : 1);
}

if (out.walls.length < MIN_FACADES) {
  console.error(`\nPOPULATION FLOOR: ${out.walls.length} facades >= ${TALL_M} m near a lamp, `
    + `want >= ${MIN_FACADES}. Either the warp did not un-cull the street or the thresholds `
    + `no longer match the world — nothing was measured.`);
  await b.close(); process.exit(3);
}
await b.close();
