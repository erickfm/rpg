// WATCH THE RETREAT, AND CHECK THE FOUR WAYS IT COULD MAKE THE WORLD WORSE.
//
// The item names them: a citizen shoved backwards must not end up in the traffic
// lane, off the kerb, inside another citizen, or oscillating. A pass/fail on the
// pin alone would not catch any of the four, so this measures each one directly
// while the taxi dwells on the crossing, and photographs the walker doing it so
// somebody can LOOK at the frame rather than trust a number.
//
//   traffic lane    the retreat must move a walker AWAY from the road centre,
//                   never further into it
//   the kerb        every sampled position must be somewhere `clearAt` allows —
//                   read back from __ct.citAvoid(), the same list crowd.ts steers on
//   another citizen no two walkers closer than 0.46 m (ct/crowd.ts clearOfPeople)
//   oscillating     count direction reversals along the walker's own heading
//
//   SHOT_URL=http://localhost:4520/ SECONDS=120 node scripts/probes/w96-watch-the-retreat.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4520/');
const SECONDS = Number(process.env.SECONDS ?? 120);
const CROSS_Z = -90.2;
const EVERY = 100;
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.walkers !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.waitForTimeout(800);

const S_PARK = await p.evaluate(async (cz) => {
  let best = null;
  for (let s = 80; s < 115; s += 1) {
    window.__ct.drive('NE', 'taxi', s);
    await new Promise((r) => requestAnimationFrame(r));
    const t = window.__ct.traffic()[0];
    if (t) { const d = Math.hypot(t.z - cz, t.x - 1.5); if (!best || d < best.d) best = { s, d }; }
  }
  return best?.s ?? 98;
}, CROSS_Z);

// PUT THE CAMERA ON THE STREET. The player SPAWNS INSIDE apartment 301
// (GOTCHAS 51) — the first four frames this probe took were of a bedroom, and a
// shot of the wrong room is worth less than no shot at all. `warp` is the
// published mover (crosstown.ts:1404); a storey change needs ~1.5 s to settle.
// Stood BACK from the crossing's east foot on purpose: a player standing on it
// is not a neutral observer — citizens hold a step short of you and go `ghost`
// when you crowd them (ct/crowd.ts:519), so watching from the spot the walkers
// need would change the thing being watched.
// Framing verified by scripts/probes/w96-frame-the-crossing.mjs: this is the one
// of four tried that actually shows the zebra and the taxi on it. The walker
// that gives ground retreats to about x = -4.6, ~11 m away down the sightline —
// far outside the 1.05 m at which citizens hold a step short of you and the
// 1.4 m at which they go `ghost` (ct/crowd.ts:519), so standing here does not
// change what is being watched.
await p.evaluate((cz) => window.__ct.warp(6.6, cz, -Math.PI / 2), CROSS_Z);
await p.waitForTimeout(1800);

let minPair = 99, worstIntoRoad = 0, reversals = 0, maxGave = 0, illegal = 0;
const trace = [];
let lastDir = 0, shot = 0, prev = null;

const t0 = Date.now();
while (Date.now() - t0 < SECONDS * 1000) {
  const s = await p.evaluate((sv) => {
    window.__ct.drive('NE', 'taxi', sv);
    return { w: window.__ct.walkers(),
      cars: window.__ct.citAvoid().filter((b) => b.actor && b.minX < 900),
      props: window.__ct.citAvoid().filter((b) => !b.actor) };
  }, S_PARK);

  // Nobody inside anybody — but measured against what the code ACTUALLY
  // enforces. `clearOfPeople` (ct/crowd.ts) skips `q.ghost`, and a citizen goes
  // ghost when the PLAYER crowds it so it can slip past rather than wall you in.
  // Counting ghosts here read 0.04 m and looked like this change letting people
  // stand inside each other; it is the observer standing at the crossing making
  // them ghost, and it happens identically without the change.
  for (let i = 0; i < s.w.length; i++) {
    if (s.w[i].ghost) continue;
    for (let j = i + 1; j < s.w.length; j++) {
      if (s.w[j].ghost) continue;
      const d = Math.hypot(s.w[i].x - s.w[j].x, s.w[i].z - s.w[j].z);
      if (d < minPair) minPair = d;
    }
  }
  // the one who is giving ground
  const i = s.w.findIndex((w) => w.gave > 0.005);
  if (i >= 0) {
    const w = s.w[i];
    maxGave = Math.max(maxGave, w.gave);
    if (prev && prev.i === i) {
      const dx = w.x - prev.x;
      // retreating must take you AWAY from the road centre, not deeper in
      if (Math.abs(w.x) < Math.abs(prev.x)) worstIntoRoad = Math.max(worstIntoRoad, Math.abs(prev.x) - Math.abs(w.x));
      const dir = Math.sign(dx);
      if (dir !== 0 && lastDir !== 0 && dir !== lastDir) reversals++;
      if (dir !== 0) lastDir = dir;
    }
    // is this position legal by the same test crowd.ts uses?
    const bad = [...s.cars, ...s.props].some((a) => w.x + 0.28 > a.minX && w.x - 0.28 < a.maxX
      && w.z + 0.28 > a.minZ && w.z - 0.28 < a.maxZ);
    if (bad) illegal++;
    trace.push(`  walker ${i}  x=${w.x.toFixed(2)}  z=${w.z.toFixed(2)}  gave=${w.gave.toFixed(2)}  jam=${w.jam.toFixed(2)}`);
    if (shot < 4 && trace.length % 7 === 1) {
      await p.screenshot({ path: `shots/w96-retreat-${++shot}.png` });
    }
    prev = { i, x: w.x, z: w.z };
  } else { prev = null; lastDir = 0; }
  await p.waitForTimeout(EVERY);
}

console.log(`taxi dwelt at s=${S_PARK}; ${trace.length} samples with somebody giving ground\n`);
console.log(trace.slice(0, 26).join('\n') || '  (nobody ever gave ground)');
if (trace.length > 26) console.log(`  … ${trace.length - 26} more`);
console.log(`\nmost ground given in one episode:      ${maxGave.toFixed(2)} m`);
console.log(`closest two walkers ever got:          ${minPair.toFixed(2)} m  (clearOfPeople floor is 0.46)`);
console.log(`retreat that went INTO the road:       ${worstIntoRoad.toFixed(3)} m  (must be ~0)`);
console.log(`samples inside a prop or vehicle box:  ${illegal}  (must be 0)`);
console.log(`direction reversals while retreating:  ${reversals}`);
console.log(`shots: shots/w96-retreat-1..${shot}.png`);
if (errs.length) console.log(`\nconsole errors: ${errs.length}\n${errs.slice(0, 4).join('\n')}`);
await b.close();
