#!/usr/bin/env node
// WHY apt.gy() AND groundAt() DISAGREE AT THE KERB EDGE.
//
// Item 43 reports `apt.gy()` reading 0.00 at the kerb edge while `groundAt()`
// reads 0.14, and calls the bookkeeping adrift. But `crosstown.ts:780`'s
// `groundPick` routes EVERY return through `apt.setGy(y)`, and
// `apartment.ts:3253` is `setGy: (v) => (lastGy = v)` — it stores exactly what
// it hands back. `groundAt` IS `groundPick` (crosstown.ts:984). So the two
// cannot disagree about the SAME COORDINATE; if they disagree, the coordinates
// differ.
//
// This asks the world which it is. It reads `apt.gy()` FIRST and `groundAt`
// second, deliberately: `groundAt` is not a pure read — it calls `setGy` and
// MUTATES the very number under test, so sampling in the other order would
// destroy the evidence.
//
//   SHOT_URL=http://localhost:<port>/ node scripts/probes/w25-kerb-gy.mjs
//
// Exit codes are the house convention (GOTCHAS §32): 0 fine, 1 wrong, 2 usage,
// 3 aborted — nothing measured.
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('ABORTED: set SHOT_URL to YOUR OWN server.'); process.exit(3); }

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
const errs = []; p.on('pageerror', (e) => errs.push(String(e.message)));
try {
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
} catch (e) {
  console.error(`ABORTED: ${URL} did not serve a world — ${String(e.message).split('\n')[0]}`);
  await b.close(); process.exit(3);
}
await reportWorld(p, URL);

const settle = () => p.evaluate(() => new Promise((resolve, reject) => {
  let last = null, stable = 0, frames = 0;
  const tick = () => {
    const y = window.__ct.camY();
    if (last !== null && Math.abs(y - last) < 1e-4) stable++; else stable = 0;
    last = y;
    if (stable >= 6) return resolve(y);
    if (++frames > 300) return reject(new Error('camera never settled'));
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}));

// jump-walk.mjs's own spot list, verbatim — the same rows the item is about.
const SPOTS = [
  ['the pavement', -6.0, -20.0, 0.14],
  ['the kerb edge', -5.1, -20.0, 0.14],
  ['the road', -2.0, -20.0, 0],
];

let bad = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FAIL'}  ${msg}`); if (!ok) bad++; };

console.log('\nWHERE THE PLAYER ACTUALLY STANDS, vs where the probe aimed.\n');
const rows = [];
for (const [what, x, z, gy] of SPOTS) {
  await p.evaluate(([x, z, gy]) => window.__ct.warp(x, z, 0, gy, 0), [x, z, gy]);
  const cam = await settle();
  // gy FIRST — groundAt mutates it.
  const r = await p.evaluate(() => {
    const q = window.__ct.pos();
    return { px: q[0], pz: q[2], gy: q[3], cam: window.__ct.camY() };
  });
  const atAimed = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [x, z]);
  const atActual = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [r.px, r.pz]);
  rows.push({ what, x, z, ...r, atAimed, atActual, cam });
  console.log(`  ${what.padEnd(16)} aimed (${x.toFixed(2)}, ${z.toFixed(2)})  actually stands at`
    + ` (${r.px.toFixed(3)}, ${r.pz.toFixed(3)})  drift ${Math.hypot(r.px - x, r.pz - z).toFixed(3)} m`);
  console.log(`  ${''.padEnd(16)} apt.gy()=${r.gy.toFixed(3)}   groundAt(aimed)=${atAimed.toFixed(3)}`
    + `   groundAt(actual)=${atActual.toFixed(3)}   camY=${cam.toFixed(3)}\n`);
  void gy;
}

// THE REAL QUESTION. apt.gy() is written by groundPick at the position the RIG
// occupies, so it must equal groundAt sampled at THAT position — not at the one
// the probe aimed for.
for (const r of rows) {
  check(Math.abs(r.gy - r.atActual) < 1e-6,
    `${r.what}: apt.gy() (${r.gy.toFixed(3)}) equals groundAt at the player's ACTUAL`
    + ` position (${r.atActual.toFixed(3)}) — one writer of record, as setGy promises`);
}

// And the camera, which is the thing the player experiences, must sit one eye
// height above the ground under the rig. Derived from the first row rather than
// typed (GOTCHAS §20).
const EYE = rows[0].cam - rows[0].atActual;
for (const r of rows) {
  check(Math.abs((r.cam - r.atActual) - EYE) < 0.02,
    `${r.what}: the camera rests ${(r.cam - r.atActual).toFixed(3)} m above the ground`
    + ` beneath the rig, matching every other spot's ${EYE.toFixed(3)} m`);
}

// ── THE MECHANISM, demonstrated rather than argued ──────────────────────────
//
// `groundAt` looks like a query and is a WRITE: crosstown.ts:780 routes every
// return through `apt.setGy`. So asking about a coordinate the player is not
// standing on silently rewrites which storey the player is recorded as being
// on. Nothing about the player changes in between here — no warp, no key, and
// the assertion below is that the rig has not moved.
console.log('  IS groundAt A PURE READ? Ask about the road while standing on the pavement.\n');
await p.evaluate(() => window.__ct.warp(-6.0, -20.0, 0, 0.14, 0));
await settle();
// SAMPLED INSIDE ONE evaluate, so no frame can run between the three reads.
// Taking them as three separate calls hides the fault completely: the frame
// loop re-runs `rig.update` -> `groundPick(player)` every frame and puts the
// player's own ground back, so the mutation is invisible a frame later. That
// is not the accessor being pure; it is the damage being repaired before you
// looked.
const seq = await p.evaluate(() => {
  const q0 = window.__ct.pos();
  const asked = window.__ct.groundAt(-2.0, -20.0);     // the road, 0.00
  const q1 = window.__ct.pos();
  return { px: q0[0], pz: q0[2], gy0: q0[3], asked, gy1: q1[3], px1: q1[0], pz1: q1[2] };
});
console.log(`    standing at (${seq.px.toFixed(3)}, ${seq.pz.toFixed(3)})  apt.gy() = ${seq.gy0.toFixed(3)}`);
console.log(`    asked groundAt(-2.00, -20.00) -> ${seq.asked.toFixed(3)}   (the player did not move)`);
console.log(`    apt.gy() immediately after, same tick: ${seq.gy1.toFixed(3)}\n`);

const moved = Math.hypot(seq.px1 - seq.px, seq.pz1 - seq.pz);
check(moved < 1e-6, `the rig did not move during the query (${moved.toFixed(6)} m)`);
// Asserted in the direction that makes the FAULT the failure: a pure read would
// leave gy alone. This is EXPECTED TO FAIL, and its failing is the finding.
check(seq.gy0 === seq.gy1,
  `groundAt is a PURE READ — apt.gy() survived a query about another coordinate`
  + ` (${seq.gy0.toFixed(3)} -> ${seq.gy1.toFixed(3)}). If this FAILS, the accessor`
  + ` is a writer and every per-frame caller of groundPick rewrites the player's storey.`);

// And the repair: one frame later the loop has put it back, which is why three
// separate evaluate calls see nothing wrong.
await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const healed = await p.evaluate(() => window.__ct.pos()[3]);
console.log(`    one frame later, the loop has rewritten it: ${healed.toFixed(3)}\n`);

const kerb = rows.find((r) => r.what === 'the kerb edge');
console.log(`\n  kerb edge: aimed groundAt ${kerb.atAimed.toFixed(3)}, actual groundAt`
  + ` ${kerb.atActual.toFixed(3)}, apt.gy() ${kerb.gy.toFixed(3)},`
  + ` drift ${Math.hypot(kerb.px - kerb.x, kerb.pz - kerb.z).toFixed(3)} m\n`);

check(errs.length === 0, `no page errors (${errs.length})`);
await b.close();
console.log(bad === 0 ? '\n  the bookkeeping agrees with itself everywhere.\n' : `\n  ${bad} FAILED.\n`);
process.exit(bad === 0 ? 0 : 1);
