// Item 265, step 4 — WALK the east pavement at every x across its width, and
// find out where a player can actually get through.
//
// WHAT STEPS 1-3 ESTABLISHED. Holding W from (6, −40) walks 3.7 m and stops
// DEAD at z ≈ −36.3 — not a 5.5-6.0 s stall, a permanent stop, 5/5, with no
// walker within 6 m on four of five runs. The obstruction is one untagged
// static collider, x 5.07…5.731 × z −35.92…−34.08, and the scene graph names
// it: the BUS STOP BENCH (`props.ts:2806`, `BENCH_Z = -35.0`, with its
// `benchAd` "TONY'S PIZZA" panel forming the back).
//
// WHY THIS PROBE EXISTS RATHER THAN A FIX. `props.ts:2795-2806` states the
// authoring standard in its own words:
//
//   "the lamp poles ... block out to x ≈ 6.11 with the rig's 0.36 m radius,
//    and the wall bites at 6.34: the bench reaches only 5.66, so it never
//    becomes the narrowest point on the walk."
//
// So the design intends furniture to hug the kerb and the player to walk the
// WALL side. If that is true, (6, −40) is simply inside the furniture envelope
// and the "stall" is a probe standing in the wrong place. If it is NOT true —
// if the envelope has drifted and there is no continuous walkable line at all —
// then it is a real defect on a route the player takes. **That is a question
// about walking, so it is answered by walking** (BUILDER-BRIEF §10), at every
// x across the pavement, in both directions.
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
const HOLD = Number(process.env.HOLD_MS ?? 6000);
const RUNS = Number(process.env.RUNS ?? 1);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForFunction(() => (window.__ct.painted?.()?.triangles ?? 0) > 0, { timeout: 20000 });

const R = await p.evaluate(() => window.__ct.playerRadius());
console.log(`\nplayer radius ${R} m.  Holding W for ${HOLD} ms per lane, ${RUNS} run(s) each.`);

/** walk from (x, z0) toward yaw, return where he ended up */
const walk = async (x, z0, yaw) => {
  await p.evaluate(([X, Z, Y]) => window.__ct.warp(X, Z, Y, 0, 0), [x, z0, yaw]);
  await p.waitForTimeout(260);
  const a = await p.evaluate(() => window.__ct.pos());
  await p.keyboard.down('w');
  await p.waitForTimeout(HOLD);
  await p.keyboard.up('w');
  await p.waitForTimeout(120);
  const c = await p.evaluate(() => window.__ct.pos());
  return { x0: a[0], z0: a[2], x1: c[0], z1: c[2] };
};

// NORTH is +z (yaw π): crosstown.ts:1195 gives fwd = (sin yaw, 0, −cos yaw),
// and D-walk's own stations put "side st N" at z −96.5 against "side st S" at
// z −109.5 — the larger z is north. Two independent sources, which is the only
// reason to believe either.
const NORTH = Math.PI, SOUTH = 0;
for (const [name, yaw, from, want] of [['north', NORTH, -40, -30], ['south', SOUTH, -30, -40]]) {
  console.log(`\n── walking ${name} from z = ${from}, past the bench at z −35.9…−34.1 ──`);
  console.log('    x      ended at            travelled    got past the bench?');
  // LANES=6.0,6.1 narrows the sweep to the decisive pair for a five-run verdict;
  // unset, it sweeps the whole pavement width to FIND that pair in the first
  // place. Both are wanted and they are the same measurement.
  const xs = process.env.LANES
    ? process.env.LANES.split(',').map(Number)
    : Array.from({ length: 12 }, (_, i) => +(5.6 + i * 0.1).toFixed(2));
  for (const x of xs) {
    const lanes = [];
    for (let r = 0; r < RUNS; r++) lanes.push(await walk(+x.toFixed(2), from, yaw));
    const past = lanes.map((w) => (name === 'north' ? w.z1 > -34.0 : w.z1 < -36.0));
    const w = lanes[lanes.length - 1];
    const trav = lanes.map((q) => Math.abs(q.z1 - q.z0));
    const agree = past.every((q) => q === past[0]);
    console.log(`  ${x.toFixed(2)}   (${w.x1.toFixed(2)}, ${w.z1.toFixed(2)})   `
      + `${Math.min(...trav).toFixed(2)}–${Math.max(...trav).toFixed(2)} m   `
      + `${past[0] ? 'YES' : 'NO  — stopped'}`
      + `   ${past.filter(Boolean).length}/${RUNS} runs${agree ? ' AGREE' : ' ⚠ DISAGREE'}`
      + `${past[0] && Math.abs(w.x1 - w.x0) > 0.05 ? `  (slid ${(w.x1 - w.x0).toFixed(2)} m in x)` : ''}`);
    void want;
  }
}
await b.close();
