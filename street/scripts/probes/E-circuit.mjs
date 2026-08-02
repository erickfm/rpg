// WALK THE LOOP THE WHOLE WAY ROUND, AND ARRIVE BACK AT THE GATE.
//
// The queue's own sentence for this item is a walk test and nothing was
// running it: *"It must be continuous, return to itself, and enclose the open
// middle — you should be able to set off from the gate and arrive back at it
// without retracing."*
//
// `E-park-walk` walks legs — in through the gate, along the frontage — and
// each leg passing says nothing about whether they join up. A loop with one
// leg blocked by a bin still passes every individual leg. And CLAUDE.md is
// explicit that anything involving movement or collision is verified by
// actually walking it, not from a screenshot, so this holds W and steers,
// rather than checking that four path decals exist.
//
// It steers in the PLAYER's convention — the camera looks along
// (sin yaw, -cos yaw), measured by warping to yaw 0 and holding W, which moves
// -z. The park's meshes use the other one, (sin yaw, cos yaw), and confusing
// the two is the bug this script tripped over on its first run: leg 1 passed
// because its cos term is zero and leg 2 walked away from its target.
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4182/';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 900, height: 600 } });
page.on('pageerror', (e) => console.error('PAGEERR', e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);
await page.evaluate(() => window.__ct.clock(13, 20));

// THE LOOP RECTANGLE, from the hoop rail rather than from the benches.
//
// The first version took the bounding box of the park's seats and inset it.
// That set includes the SHELTER's bench, which is not on the loop at all —
// it sits 3.4 m west of the west leg — so the west corner landed inside the
// shelter's posts and the walker jammed there. A check reporting the park
// broken because the check was aiming off the path.
//
// The hoop rail is the honest landmark: `park.ts` places it at exactly
// PATH_W/2 + 0.25 = 1.0 m off each leg, on the field side, all the way round.
// So the extreme hoops give the loop back with no constants copied from the
// source and no bench in it.
const L = await page.evaluate(() => {
  const V3 = Object.getPrototypeOf(window.__ct.scene().position).constructor;
  const hoops = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || o.geometry?.type !== 'BoxGeometry') return;
    const q = o.geometry.parameters;
    if (!q) return;
    // a hoop leg: 0.05 square, 0.29 tall
    const thin = Math.abs(q.width - 0.05) < 0.02 && Math.abs(q.depth - 0.05) < 0.02;
    if (!thin || Math.abs(q.height - 0.29) > 0.05) return;
    o.updateWorldMatrix(true, false);
    const c = new V3().setFromMatrixPosition(o.matrixWorld);
    if (c.x < -39 || c.x > -7 || c.z < -99 || c.z > -67) return;
    hoops.push({ x: c.x, z: c.z });
  });
  return { hoops };
});
if (L.hoops.length < 20) {
  console.log(`EXIT 3: found ${L.hoops.length} hoops — cannot locate the loop, so not judging it`);
  await b.close(); process.exit(3);
}
const OFF = 1.0;                       // PATH_W/2 + 0.25, park.ts
const hx = L.hoops.map((h) => h.x), hz = L.hoops.map((h) => h.z);
const x0 = Math.min(...hx) - OFF, x1 = Math.max(...hx) + OFF;
const z0 = Math.min(...hz) - OFF, z1 = Math.max(...hz) + OFF;
const CORNERS = [[x1, z0], [x0, z0], [x0, z1], [x1, z1]];
console.log(`loop from ${L.hoops.length} hoops: x ${x0.toFixed(1)}..${x1.toFixed(1)}  z ${z0.toFixed(1)}..${z1.toFixed(1)}`);

const pos = () => page.evaluate(() => window.__ct.pos());
const warp = (x, z, yaw) => page.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0.14, 0), [x, z, yaw]);
// TO STEER THE PLAYER toward a point: the camera looks along (sin yaw,-cos yaw),
// so yaw = atan2(dx, -dz). The mesh convention, atan2(dx, dz), is the OTHER one
// and using it here sent leg 2 off in the opposite direction — the same z-flip
// that had sitters facing the boundary wall.
const aim = (from, to) => Math.atan2(to[0] - from[0], -(to[1] - from[1]));
// pos() is [x, HEIGHT, z, groundY] — index 1 is how tall the player is, not
// where they are. The first run of this used p[1] as z, so it steered toward
// a target at z = 1.62 and marched 225 m out of the park down the main road,
// reporting the loop as broken. An assumed array shape, measured in the end
// by just printing it.
const XZ = (p) => [p[0], p[2]];
const dist = (p, t) => Math.hypot(p[0] - t[0], p[1] - t[1]);

// hold W toward a target, re-aiming every 260 ms, and give up after `budget`
const legTo = async (target, budget = 20000) => {
  let p = XZ(await pos()), moved = 0, bias = 0, stalls = 0;
  const t0 = Date.now();
  await page.keyboard.down('w');
  while (Date.now() - t0 < budget) {
    const before = p;
    await page.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0.14, 0),
      [before[0], before[1], aim(before, target) + bias]);
    await page.waitForTimeout(300);
    p = XZ(await pos());
    const step = Math.hypot(p[0] - before[0], p[1] - before[1]);
    moved += step;
    // STEP ROUND IT, the way a person does. A bench stands in the eastern half
    // of the west leg with about a metre of path clear beside it, and a bot
    // that only ever walks straight at the next corner jams on it and reports
    // the loop as broken. That would be a limit of this script filed as a
    // fault in the park. On a stall, swing the aim aside and try again —
    // widening, alternating, and giving up only if a 60 degrees either way
    // still gets nowhere. That is a genuinely blocked leg.
    if (step < 0.25) {
      stalls++;
      bias = (stalls % 2 ? 1 : -1) * (Math.PI / 9) * Math.ceil(stalls / 2);
      if (Math.abs(bias) > Math.PI / 3) break;
    } else { stalls = 0; bias = 0; }
    if (dist(p, target) < 1.5) break;
  }
  await page.keyboard.up('w');
  await page.waitForTimeout(80);
  return { at: XZ(await pos()), moved };
};

const START = CORNERS[0];
await warp(START[0], START[1], aim(START, CORNERS[1]));
await page.waitForTimeout(200);
let fails = 0, total = 0;
for (let i = 1; i <= CORNERS.length; i++) {
  const target = CORNERS[i % CORNERS.length];
  const r = await legTo(target);
  total += r.moved;
  const d = dist(r.at, target);
  const ok = d < 2.2;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  leg ${i} to ${target.map((n) => n.toFixed(1))}  ` +
    `ended ${r.at[0].toFixed(1)},${r.at[1].toFixed(1)}  ${d.toFixed(2)} m short  (walked ${r.moved.toFixed(1)} m)`);
}
const home = XZ(await pos());
const back = dist(home, START);
const closed = back < 2.5;
if (!closed) fails++;
console.log(`${closed ? 'PASS' : 'FAIL'}  back at the gate end: ${back.toFixed(2)} m from where I set off, ${total.toFixed(0)} m walked`);
// a circuit that never moved is not a circuit — GOTCHAS 34
if (total < 30) { console.log(`EXIT 3: only ${total.toFixed(0)} m of movement; the walker never went anywhere`); await b.close(); process.exit(3); }
console.log(fails ? `\n${fails} leg(s) of the loop do not join up`
  : `\nthe loop is continuous: set off from the gate, walked ${total.toFixed(0)} m, arrived back`);
await b.close();
process.exit(fails ? 1 : 0);
