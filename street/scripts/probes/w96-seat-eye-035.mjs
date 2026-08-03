// WHERE DOES THE 0.35 m COME FROM?
//
// `seats-walk.mjs` reports 109 failures over 219 seats, and item 255 says that
// number is a FIXED-YAW artifact. It is an artifact, but not that one:
// classifying the 109 by message gives
//
//    85  seated eye is N, expected N        <- 78% of them
//    11  sat at N,N but the seat is at N,N
//     8  no prompt; got some OTHER [E] label
//     4  seated prompt should be "stand up", got null
//     1  no prompt; got null                 <- the only pure "nothing there"
//
// and of those 85, **83 are off by EXACTLY 0.350 m**. A single constant, not 83
// broken seats.
//
// The formula is not the disagreement: the harness computes
// `floor + pose.h + SIT_EYE` and `fp.ts:486` computes `sgy + seat.h + SIT_EYE`,
// with SIT_EYE 0.72 on both sides (`fp.ts:102`, `seats-walk.mjs:28`). So one of
// the two INPUTS differs. This asks the world for both, on seats that fail and
// seats that pass, and reports which term carries the 0.35.
//
//   SHOT_URL=http://localhost:4520/ node scripts/probes/w96-seat-eye-035.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4520/');
const SIT_EYE = 0.72;                 // fp.ts:102
const RADIUS = 0.36;
const N = Number(process.env.N ?? 18);

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

console.log('\nlabel                              pose.h  posY   groundAt  camY   want   err');
const rows = [];
const step = Math.max(1, Math.floor(seats.length / N));
for (let i = 0; i < seats.length; i += step) {
  const s = seats[i];
  if (await p.evaluate(() => window.__ct.seated())) {
    await p.evaluate(() => window.__ct.stand && window.__ct.stand());
    await p.waitForTimeout(70);
  }
  const st = await standableNear(s.at, s.r);
  if (!st) continue;
  const yaw = Math.atan2(s.pose.x - st.x, s.pose.z - st.z);
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0), [st.x, st.z, yaw]);
  await p.waitForTimeout(130);
  await p.keyboard.down('e'); await p.waitForTimeout(90); await p.keyboard.up('e');
  await p.waitForTimeout(120);
  if (!(await p.evaluate(() => window.__ct.seated()))) continue;
  const m = await p.evaluate(([px, pz]) => ({
    pos: window.__ct.pos(),
    cam: window.__ct.camY(),
    ground: window.__ct.groundAt(px, pz),
  }), [s.pose.x, s.pose.z]);
  const want = m.pos[3] + s.pose.h + SIT_EYE;
  const err = want - m.cam;
  rows.push({ label: s.label, h: s.pose.h, posY: m.pos[1], ground: m.ground, cam: m.cam, want, err });
  console.log(`${s.label.slice(0, 32).padEnd(34)}${s.pose.h.toFixed(2)}   `
    + `${m.pos[1].toFixed(2)}   ${m.ground.toFixed(2)}     ${m.cam.toFixed(2)}  `
    + `${want.toFixed(2)}  ${err >= 0 ? '+' : ''}${err.toFixed(3)}`);
  await p.evaluate(() => window.__ct.stand && window.__ct.stand());
  await p.waitForTimeout(60);
}

if (!rows.length) { console.log('REFUSING TO REPORT: could not seat on any sampled seat'); await b.close(); process.exit(3); }
const bad = rows.filter((r) => Math.abs(r.err) > 0.04);
console.log(`\n${rows.length} seats sat on; ${bad.length} disagree with the harness formula by > 0.04`);
if (bad.length) {
  const errs = [...new Set(bad.map((r) => r.err.toFixed(3)))];
  console.log(`distinct error values: ${errs.join(', ')}`);
  // Does camY - posY equal SIT_EYE? If so the RIG is consistent and the
  // harness's `pose.h` is the term that is wrong.
  const lift = bad.map((r) => +(r.cam - r.posY).toFixed(3));
  console.log(`camY - posY on the failing ones: ${[...new Set(lift)].join(', ')}  (SIT_EYE is ${SIT_EYE})`);
  const floorGap = bad.map((r) => +(r.posY - r.ground).toFixed(3));
  console.log(`posY - groundAt(seat):           ${[...new Set(floorGap)].join(', ')}`);
}
await b.close();
