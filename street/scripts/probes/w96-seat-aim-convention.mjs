// WHICH AIM ACTUALLY RAISES THE SEAT'S PROMPT? Settle it on a handful of seats
// before spending ten minutes running the full 219.
//
// Two open questions, and guessing either wrong makes the corrected harness look
// like it fixed nothing:
//
//  1. THE HEADING CONVENTION. `notes/ninetynine-item126...` proposes
//     `atan2(dx, -dz)`; everything else in this world uses `atan2(dx, dz)`
//     (0 faces +z) — `ct/crowd.ts` bills a walker's facing that way. One of them
//     is 180 degrees wrong on the z axis.
//  2. WHAT TO AIM AT. A seat record is `{ pose, at, r, label }`: `at` is the
//     approach spot and `pose` is the seat. `seats-walk.mjs` picks its standing
//     point INSIDE `at`'s radius, so the bearing from that point to `at` can be
//     5 cm long and is therefore noise. Aiming at `pose` should be stable.
//
// Four candidates per seat, each warped and asked whether the seat's own prompt
// came up. The winner is whichever raises the most prompts — measured, not
// argued.
//
//   SHOT_URL=http://localhost:4520/ N=24 node scripts/probes/w96-seat-aim-convention.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4520/');
const N = Number(process.env.N ?? 24);
const RADIUS = 0.36;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

const seats = await p.evaluate(() => window.__ct.seats());
const standableNear = (at, r) => p.evaluate(([at, r, RAD]) => {
  const cols = window.__ct.colliders();
  const blocked = (x, z) => cols.some((c) =>
    x > c.minX - RAD && x < c.maxX + RAD && z > c.minZ - RAD && z < c.maxZ + RAD);
  for (let ring = 0.05; ring <= r; ring += 0.07) {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const x = at.x + Math.cos(a) * ring, z = at.z + Math.sin(a) * ring;
      if (!blocked(x, z)) return { x, z };
    }
  }
  return null;
}, [at, r, RADIUS]);
const promptNow = () => p.evaluate(() => {
  const e = document.getElementById('ct-prompt');
  return e && e.style.display !== 'none' ? e.textContent : null;
});

const CANDS = [
  ['yaw 0 (today)', (s, st) => 0],
  ['atan2(dx,dz) -> pose', (s, st) => Math.atan2(s.pose.x - st.x, s.pose.z - st.z)],
  ['atan2(dx,-dz) -> pose', (s, st) => Math.atan2(s.pose.x - st.x, -(s.pose.z - st.z))],
  ['atan2(dx,dz) -> at', (s, st) => Math.atan2(s.at.x - st.x, s.at.z - st.z)],
];
const hit = CANDS.map(() => 0);
let judged = 0, poseDist = 0, atDist = 0;

const step = Math.max(1, Math.floor(seats.length / N));
for (let i = 0; i < seats.length; i += step) {
  const s = seats[i];
  const st = await standableNear(s.at, s.r);
  if (!st) continue;
  judged++;
  poseDist += Math.hypot(s.pose.x - st.x, s.pose.z - st.z);
  atDist += Math.hypot(s.at.x - st.x, s.at.z - st.z);
  for (let c = 0; c < CANDS.length; c++) {
    const y = CANDS[c][1](s, st);
    await p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0, 0), [st.x, st.z, y]);
    await p.waitForTimeout(130);
    const pr = await promptNow();
    if (pr && pr.includes(s.label)) hit[c]++;
  }
}

if (!judged) { console.log('REFUSING TO REPORT: no seat had a standable point'); await b.close(); process.exit(3); }
console.log(`\n${judged} seats sampled (every ${step}th of ${seats.length})\n`);
for (let c = 0; c < CANDS.length; c++) {
  console.log(`  ${CANDS[c][0].padEnd(24)} raised the seat's own prompt ${hit[c]}/${judged}`
    + `  (${(100 * hit[c] / judged).toFixed(0)}%)`);
}
console.log(`\nmean distance from the standing point to  pose: ${(poseDist / judged).toFixed(2)} m`);
console.log(`                                           at: ${(atDist / judged).toFixed(2)} m`
  + '   <- a short one here is why aiming at `at` is noise');
await b.close();
