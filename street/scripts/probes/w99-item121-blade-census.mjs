#!/usr/bin/env node
// ITEM 121 — IS THE SIDE SIGN THE USER ASKED ABOUT ACTUALLY GONE FROM THE WORLD?
//
//   *"casino sign still a lil janky. maybe we get rid of the one on the side
//    here? add more flair to the bulbs themselves instead?"*
//
// `ct/vice.ts` carries a long tombstone saying the SEVENS blade was removed by
// item 132. A COMMENT IS NOT A MEASUREMENT — BUILDER-BRIEF §6 — and this project
// has a documented family of rows that read as done and were not (GOTCHAS 49).
// So: count the blade-shaped objects on the side-street elevation and say which
// building each stands on.
//
// A BLADE, declared: a tall narrow cabinet hung off the facade. Tall (> 6 m of
// vertical extent), narrow across the frontage (< 2.5 m in x), and standing
// PROUD of the wall — which means a z-depth of ROUGHLY A METRE, not merely a
// large one.
//
// ⚠ THAT LAST CLAUSE IS THE WHOLE PROBE, AND MY FIRST CUT GOT IT WRONG. Written
// as "d > 0.5" it reported **3 blades still standing on SEVENS** and exited 1 —
// a confident, specific, wrong answer of exactly the kind BUILDER-BRIEF §7
// describes. What it had actually found:
//
//   x 51.0/51.2/51.5   y 19.4..26.0   d 6.8..7.2   ← THE ROOFTOP BOARD
//   x 45.2             y 7..24        d 26, 22     ← wall slabs seen end-on
//
// The rooftop board is the skyline mark that the item's own text names — *"the
// rooftop board is 26.0 m"* — and the tombstone in ct/vice.ts is explicit that
// it STAYS; it is the thing that took over the long view when the blade went.
// It is 7 m deep because its faces point along x. The removed blade was 1.35 m
// proud and topped out at 21.4 m, so depth is precisely what separates them,
// and **nothing on this elevation now tops out at 21.4 m at all.**
//
// Both buildings are reported whether or not anything is found, so an empty
// answer cannot be confused with a probe that measured nothing: HOTEL ORPHEUS
// must still HAVE its blade (the user never complained about it and the item
// does not touch it), and that is this probe's positive control.
//
//   SHOT_URL=http://localhost:<port>/ node scripts/probes/w99-item121-blade-census.mjs
import { chromium } from 'playwright';
import { waitPainted } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('ABORTED: set SHOT_URL — exit 3, nothing measured.'); process.exit(3); }

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 60000 });
await waitPainted(p, { quiet: true });

const out = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const hits = [], rejects = [];
  let scanned = 0;
  s.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
    if (!g.boundingBox) return;
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    // the vice block's side-street elevation faces -z around z = -97
    if (bb.max.z < -101 || bb.min.z > -93) return;
    if (bb.max.x < 20 || bb.min.x > 70) return;
    scanned++;
    const h = bb.max.y - bb.min.y, w = bb.max.x - bb.min.x, d = bb.max.z - bb.min.z;
    const rec = {
      x: +((bb.min.x + bb.max.x) / 2).toFixed(2),
      y0: +bb.min.y.toFixed(2), y1: +bb.max.y.toFixed(2),
      w: +w.toFixed(2), d: +d.toFixed(2),
    };
    if (h > 6 && w < 2.5 && d >= 0.5 && d <= 2.5) hits.push(rec);
    // everything tall and narrow, whatever its depth — so the rejects are
    // VISIBLE and a reader can see what the depth clause threw away.
    else if (h > 6 && w < 2.5 && d > 2.5) rejects.push(rec);
  });
  return { hits, rejects, scanned };
});

console.log(`meshes scanned on the vice side elevation: ${out.scanned}`);
if (out.scanned < 200) {
  console.log('EXIT 3 — too few meshes in the region; the probe is aimed at nothing.');
  await b.close(); process.exit(3);
}
console.log(`blade-shaped (tall > 6 m, narrow < 2.5 m, proud 0.5..2.5 m): ${out.hits.length}`);
for (const h of out.hits.sort((a, z) => a.x - z.x)) {
  console.log(`  x ${String(h.x).padStart(6)}   y ${h.y0}..${h.y1}   ${h.w} wide, ${h.d} proud`);
}
console.log(`tall+narrow but TOO DEEP to be a blade — shown so the filter is auditable: ${out.rejects.length}`);
for (const h of out.rejects.sort((a, z) => a.x - z.x)) {
  console.log(`  x ${String(h.x).padStart(6)}   y ${h.y0}..${h.y1}   ${h.w} wide, ${h.d} deep`
    + `${h.y1 > 25 && h.y1 < 27 ? '   <- the rooftop board, which STAYS' : ''}`);
}
const at214 = [...out.hits, ...out.rejects].filter((h) => Math.abs(h.y1 - 21.4) < 0.6);
console.log(`\nobjects topping out at the removed blade's 21.4 m: ${at214.length}`);

// SEVENS spans the high x end of the block (its facade name sits at 51.29);
// HOTEL ORPHEUS is the lower-x neighbour. Split at the gap between them.
const sevens = out.hits.filter((h) => h.x > 46);
const orpheus = out.hits.filter((h) => h.x <= 46);
console.log(`\n  SEVENS  (x > 46): ${sevens.length} blade(s)  ← the user asked for this one to GO`);
console.log(`  ORPHEUS (x <= 46): ${orpheus.length} blade(s)  ← must remain; positive control`);

// ── and LOOK at it, from the pavement, at the hour the bulbs are the point ──
// Shots are for looking, never for proving (BUILDER-BRIEF §10) — the proof is
// above and in w51-chase-program.mjs. This is so the verdict in the handoff is
// one a human actually formed.
import { mkdirSync } from 'node:fs';
mkdirSync('shots', { recursive: true });
for (const [tag, hh] of [['night', 21], ['day', 13]]) {
  await p.evaluate((h) => window.__ct.clock(h, 0), hh);
  await p.waitForTimeout(1000);
  // THE USER'S OWN STATION, copied from scripts/probes/w51-frontage-without-
  // blade.mjs:19 (`{ id: 'hero', x: 53.6, z: -103.2, yaw: PI, pitch: 0.62 }` —
  // its comment is literally "his frame"). Cited rather than re-derived: my own
  // guess at where to stand put the camera inside a wall, because this facade
  // faces −z and I had assumed +z. BUILDER-BRIEF §8 — copy with a citation, do
  // not invent a second copy of a number somebody already measured.
  await p.evaluate(() => window.__ct.warp(53.6, -103.2, Math.PI, undefined, 0.62));
  await p.waitForTimeout(900);
  const f = `shots/item121-sevens-${tag}.png`;
  await p.screenshot({ path: f });
  console.log(`  looked: ${f}`);
}

const ok = sevens.length === 0 && orpheus.length > 0;
await b.close();
console.log(`\n${ok ? 'PASS' : 'FAIL'} — the casino's side blade is ${sevens.length === 0 ? 'gone' : 'STILL THERE'}`
  + `, the hotel's is ${orpheus.length > 0 ? 'still standing' : 'MISSING — the probe may be blind'}.`);
process.exit(ok ? 0 : 1);
