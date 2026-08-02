#!/usr/bin/env node
// THE WALK-UP HALF OF THE groundPick SIDE EFFECT, which the kerb probe cannot see.
//
// `scripts/probes/w25-kerb-gy.mjs` proves the OUTDOOR half: asking `groundAt`
// about the road while standing on the pavement used to move `apt.gy()` to road
// level for one frame. But outdoors every return went through `apt.setGy`, and
// the fix there is one flag on `groundPick`.
//
// Inside No. 227 the writer is a different one. `crosstown.ts` hands x > 100
// straight to `apt.ground` (ct/apartment.ts's `aptGround`), which assigned
// `lastGy` ITSELF, from its own hysteresis — so a pure wrapper around it would
// still have leaked. That needed the same `commit` flag a level down, and this
// asks the world whether it took.
//
// Two questions, and they pull in opposite directions, which is the point:
//
//   1 A QUERY MUST NOT MOVE YOU. Standing on the lobby floor, ask about a
//     coordinate part-way up flight A. `apt.gy()` must not budge — measured in
//     ONE `evaluate` so no frame can run in between and repair it, which is
//     exactly how this fault hid from w25's first test.
//   2 THE COMMIT MUST STILL COMMIT. Then hold W and climb the stairs. If the
//     flag failed to reach the rig's own per-frame call, the picker stops
//     writing and you walk up a staircase without changing storey.
//
// NOTHING IS TYPED. The lobby comes from the world's own `[E]` spot list and
// the stair coordinate is FOUND by scanning for a ground height that is not a
// storey multiple — so the day somebody moves the staircase this still aims at
// it. (BUILDER-BRIEF §8.)
//
//   SHOT_URL=http://localhost:<port>/ node scripts/probes/w26-storey-query-pure.mjs
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

let bad = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FAIL'}  ${msg}`); if (!ok) bad++; };
const abort = async (why) => { console.error(`ABORTED: ${why}`); await b.close(); process.exit(3); };

// Settle on FRAMES, never on a wall-clock wait: this machine has run twenty
// browsers at once and a fixed timeout truncates whatever it is timing.
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

// ── GET INTO THE LOBBY THROUGH THE DOOR, not by warping to a remembered
// coordinate. The world publishes its own [E] spots; the entrance is one.
const spots = await p.evaluate(() => window.__ct.spots());
const enter = spots.find((s) => /enter No\. 227/i.test(s.label));
if (!enter) await abort('no "enter No. 227" spot in __ct.spots() — the entrance moved or was renamed');

// yaw PI faces +z (fp.ts:416, fwd = (sin yaw, 0, -cos yaw)); the stair runs +z
// from the lobby. Stand ON the entrance spot at the ground it actually has.
await p.evaluate(([x, z]) => window.__ct.warp(x, z, -Math.PI / 2, window.__ct.groundAt(x, z), 0),
  [enter.x, enter.z]);
await settle();
// HELD keypress — a tap can begin and end inside one frame and the [E] edge is
// read once per rendered frame, so `press` is never seen (BUILDER-BRIEF §5).
await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
await settle();
const inside = await p.evaluate(() => window.__ct.pos());
if (inside[0] < 100) await abort(`[E] at the entrance did not put us indoors (x = ${inside[0].toFixed(2)})`);
console.log(`\n  through the door: standing at (${inside[0].toFixed(2)}, ${inside[2].toFixed(2)})`
  + `  apt.gy() = ${inside[3].toFixed(3)}\n`);

// ── FIND FLIGHT A BY LOOKING, not by remembering. Every storey slab in the
// stack is a multiple of the storey height; a point part-way up a flight is
// not. So sweep a grid over the stairwell and keep every cell whose ground is
// neither the floor we are on nor a whole storey above it.
//
// THE HYSTERESIS IS WHY THE RAMP LOOKS SHORT. Standing at gy 0 the picker
// refuses to offer anything more than 0.6 m up, so only the first ~half metre
// of the run answers with its true height and the rest reads back as 0.00.
// That is the picker working, and it is enough to aim at.
const grid = await p.evaluate(([x0, z0]) => {
  const out = [];
  for (let dx = -3; dx <= 3.001; dx += 0.2) {
    for (let d = 0; d <= 14; d += 0.2) {
      const y = window.__ct.groundAt(x0 + dx, z0 + d);
      if (y > 0.10 && y < 1.20) out.push([+(x0 + dx).toFixed(2), +(z0 + d).toFixed(2), y]);
    }
  }
  return out;
}, [inside[0], inside[2]]);
if (!grid.length) await abort('found no part-way-up-a-flight ground anywhere in the stairwell — cannot aim');
const xs = [...new Set(grid.map((g) => g[0]))].sort((a, b) => a - b);
// The middle of the run, so the walk does not scrape the stringer. The player
// is 0.36 m wide and the flight is ~1.2 m; starting on its EDGE is what wedged
// the first version of this probe 0.37 m short of the bottom step.
const flightX = xs[Math.floor(xs.length / 2)];
const [, stairZ, stairY] = grid.find((g) => g[0] === flightX);
console.log(`  flight A found by sweep: it answers a part-way-up height across x `
  + `${xs[0].toFixed(2)}–${xs[xs.length - 1].toFixed(2)}, middle of the run x ${flightX.toFixed(2)}`);
console.log(`  ground at (${flightX.toFixed(2)}, ${stairZ}) is ${stairY.toFixed(3)} m`
  + ` — not a storey multiple, so it is part-way up a run\n`);

// ── 1. A QUESTION MUST NOT MOVE YOU ─────────────────────────────────────────
// SAMPLED INSIDE ONE evaluate. Taken as separate calls the frame loop re-runs
// the rig's own committing ground call in between and puts the storey back, so
// the fault is repaired before you can look at it.
const seq = await p.evaluate(([sx, sz]) => {
  const q0 = window.__ct.pos();
  const asked = window.__ct.groundAt(sx, sz);
  const q1 = window.__ct.pos();
  return { gy0: q0[3], asked, gy1: q1[3],
    moved: Math.hypot(q1[0] - q0[0], q1[2] - q0[2]) };
}, [flightX, stairZ]);
console.log(`    on the lobby floor at apt.gy() = ${seq.gy0.toFixed(3)}`);
console.log(`    asked groundAt(${flightX.toFixed(2)}, ${stairZ}) -> ${seq.asked.toFixed(3)}   (the player did not move)`);
console.log(`    apt.gy() immediately after, same tick: ${seq.gy1.toFixed(3)}\n`);
check(seq.moved < 1e-6, `the rig did not move during the query (${seq.moved.toFixed(6)} m)`);
check(seq.gy0 === seq.gy1,
  `asking about the STAIRCASE left the storey alone (${seq.gy0.toFixed(3)} -> ${seq.gy1.toFixed(3)}).`
  + ` If this FAILS, ct/apartment.ts's aptGround is still committing its own answer`
  + ` and every per-frame caller rewrites which floor the player is on.`);

// ── 2. THE COMMIT MUST STILL COMMIT — so WALK UP (GOTCHAS §1). ──────────────
// Sampled on rAF while the key is held, in-page, so no frame is missed.
// Step across onto the middle of flight A first — same lobby floor, so this is
// a sidestep, not a teleport between storeys.
await p.evaluate(([x]) => window.__ct.warp(x, window.__ct.pos()[2], Math.PI), [flightX]);
await settle();
const before = await p.evaluate(() => window.__ct.pos());
await p.keyboard.down('w');
const track = await p.evaluate(() => new Promise((resolve) => {
  const seen = [];
  const t0 = performance.now();
  const tick = () => {
    seen.push(window.__ct.pos()[3]);
    if (performance.now() - t0 > 5000) return resolve(seen);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}));
await p.keyboard.up('w');
await settle();
const after = await p.evaluate(() => window.__ct.pos());
const top = Math.max(...track);
const between = track.filter((y) => y > 0.05 && y < top - 0.05).length;
console.log(`\n    held W for 5 s from (${before[0].toFixed(2)}, ${before[2].toFixed(2)}) gy ${before[3].toFixed(3)}`);
console.log(`    ended at (${after[0].toFixed(2)}, ${after[2].toFixed(2)}) gy ${after[3].toFixed(3)}`
  + `  — highest storey reached ${top.toFixed(3)} m over ${track.length} frames\n`);
check(top > before[3] + 1.0,
  `holding W up flight A raised the storey by ${(top - before[3]).toFixed(3)} m — the rig's own`
  + ` ground call still COMMITS. If this FAILS the commit flag stopped reaching it and you`
  + ` climb stairs without changing floor.`);
check(between > 3,
  `the climb passed through ${between} heights BETWEEN the lobby and the top of the run —`
  + ` a real ramp, not a single snap`);

check(errs.length === 0, `no page errors (${errs.length})`);
await b.close();
console.log(bad === 0 ? '\n  asking is free; only walking moves you.\n' : `\n  ${bad} FAILED.\n`);
process.exit(bad === 0 ? 0 : 1);
