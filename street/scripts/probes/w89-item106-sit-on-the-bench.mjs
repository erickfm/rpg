// Item 106 — *"sitting looks nonsensical"*. SIT ON IT. A seat is not something
// a screenshot can settle (BUILDER-BRIEF §10).
//
// THE ARITHMETIC THIS IS TESTING. `ct/park.ts:1393` sets SEAT_Y = 0.45 and lays
// three slats at `SEAT_Y + 0.055` from a 0.05-thick box, so the surface a person
// actually rests on is
//     0.45 + 0.055 + 0.05/2 = 0.530
// and `ctx.seat({ h: 0.45 })` registers 0.45. `fp.ts:486` puts the eye at
// `ground + seat.h + SIT_EYE`, so the player should sit 0.08 m INSIDE the slats.
//
// This is a documented family: ct/int-church.ts records a pew whose top face was
// 0.50 while ctx.seat registered 0.54, and ct/int-casino.ts's STOOL_TOP comment
// says in capitals that the seat is the TOP FACE, not the centre of the cushion.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4450/';
const SIT_EYE = 0.72;                       // fp.ts:102
const TOP = 0.45 + 0.055 + 0.05 / 2;        // the slat top, from park.ts's own numbers

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 620 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.spots, null, { timeout: 30000 });
await p.evaluate(() => window.__ct.clock(12, 30));

// THE SEAT POSE, NOT THE APPROACH SPOT. `__ct.seats()` publishes both, and they
// are different places: `fp.ts:486` builds the eye off the ground under the
// SEAT, so measuring against the ground under the approach mis-reads every
// bench on a slope. That is what made bench 10 (on the park's relief, floor
// 0.48) read -0.037 m when nothing was wrong with it.
const benches = await p.evaluate(() => window.__ct.seats()
  .filter((s) => /sit on the bench/i.test(s.label ?? ''))
  .map((s) => ({ x: s.at.x, z: s.at.z, sx: s.pose.x, sz: s.pose.z, h: s.pose.h,
                 gy: window.__ct.groundAt(s.at.x, s.at.z),
                 seatGy: window.__ct.groundAt(s.pose.x, s.pose.z) })));
console.log(`benches offering "sit on the bench": ${benches.length}`);

// …AND THE TOP FACE, READ OFF THE BENCH ITSELF. The first version of this
// hard-typed 0.53 from park.ts's numbers, which cannot be right for BOTH bench
// families (ct/park.ts and ct/civic.ts build different benches) and is a second
// copy of a number the world already owns (BUILDER-BRIEF §8). `Box3` is reached
// through an existing `boundingBox` instance, since THREE itself is not on the
// page.
const topFaceAt = (sx, sz) => p.evaluate(([x, z]) => {
  let best = -Infinity;
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    if (!bb) return;
    o.updateWorldMatrix(true, false);
    const w = bb.clone().applyMatrix4(o.matrixWorld);
    // a slat you could rest on: spans this x/z, and is roughly seat-height
    if (x < w.min.x - 0.02 || x > w.max.x + 0.02) return;
    if (z < w.min.z - 0.02 || z > w.max.z + 0.02) return;
    const gy = window.__ct.groundAt(x, z);
    if (w.max.y < gy + 0.20 || w.max.y > gy + 0.80) return;   // not the ground, not the backrest
    if (w.max.y > best) best = w.max.y;
  });
  return best === -Infinity ? null : +best.toFixed(4);
}, [sx, sz]);

let n = 0, sat = 0, bad = 0;
for (const bench of benches) {
  // stand ON the approach spot and look at the bench
  await p.evaluate(([x, z, g]) => window.__ct.warp(x, z, 0, g, 0), [bench.x, bench.z, bench.gy]);
  for (let i = 0; i < 6; i++) await p.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
  const standEye = await p.evaluate(() => window.__ct.camY());
  await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
  await p.waitForTimeout(300);
  for (let i = 0; i < 8; i++) await p.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
  const st = await p.evaluate(() => ({ seated: !!window.__ct.seated(), eye: window.__ct.camY() }));
  n++;
  if (!st.seated) { console.log(`  bench ${n}: DID NOT SIT (spot offered but E did not seat)`); continue; }
  sat++;
  const top = await topFaceAt(bench.sx, bench.sz);
  if (top === null) { console.log(`  bench ${n}: no slat found under the seat pose — cannot judge`); continue; }
  const want = top + SIT_EYE;               // eye of somebody resting ON the wood
  const got = st.eye;
  const sunk = want - got;
  if (Math.abs(sunk) > 0.02) bad++;
  console.log(`  bench ${n} seat (${bench.sx.toFixed(1)}, ${bench.sz.toFixed(1)}) floor ${bench.seatGy.toFixed(2)} `
    + `h=${bench.h.toFixed(3)}: top ${top.toFixed(3)}  seated ${got.toFixed(3)}  `
    + `want ${want.toFixed(3)}  ${sunk > 0 ? 'SUNK' : 'FLOAT'} ${Math.abs(sunk).toFixed(3)} m`
    + `${Math.abs(sunk) > 0.02 ? '   <-- WRONG' : ''}`);
  void standEye; void TOP;
  if (n === 1) await p.screenshot({ path: 'shots/w89-bench-seated.png' });
  await p.evaluate(() => window.__ct.stand());
  for (let i = 0; i < 4; i++) await p.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
}
console.log(`\nsat on ${sat} of ${n}; ${bad} seated at the wrong height. console errors: ${errs.length}`);
await b.close();
