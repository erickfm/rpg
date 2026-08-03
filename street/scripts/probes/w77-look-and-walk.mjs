// Item 204 — LOOK at the THRIFT frontage and the alley, and WALK the frontage.
//
// The row's DONE WHEN: "the pavement in front of THRIFT is clear, nothing is
// orphaned, the walking lane is clear, you have walked past it".
//
// Three things this does that w74's scoping shot did not:
//  · aims at the crate's old spot from ALONG the pavement, not from in front
//    of the door facing away (w74 says its own frame faces the wrong way and
//    is not evidence of anything)
//  · waits on `__ct.painted()`, not on `__ct` existing (GOTCHAS 78/80)
//  · WALKS the frontage with the rig and reports where it actually got to,
//    because a screenshot cannot prove you are not wedged
//
//   SHOT_URL=http://localhost:4330/ node scripts/probes/w77-look-and-walk.mjs [tag]
import { aim } from '../lib/aim.mjs';
import { waitPainted, blackFraction } from '../lib/painted.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4330/');
const TAG = process.argv[2] ?? 'after';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.spots !== undefined, { timeout: 30000 });
await waitPainted(p);

let fails = 0;
const bad = (m) => { fails++; console.log(`  FAIL ${m}`); };
const ok = (m) => console.log(`  OK   ${m}`);

const D = (await p.evaluate(() => window.__ct.spots().map((s) => ({ x: s.x, z: s.z, label: s.label }))))
  .find((s) => /thrift/i.test(s.label));
if (!D) { console.log('REFUSING TO REPORT: no THRIFT spot'); await b.close(); process.exit(3); }

// yaw convention, taken from the world rather than assumed: forward is
// (sin yaw, -cos yaw) — yaw 0 looks down -z. Verified below by warping and
// reading __ct.pos() is not enough (warp does not move you), so instead every
// shot here aims with an explicit atan2 from the standing point to the target
// and the images are then LOOKED AT.
const look = (fx, fz, tx, tz) => Math.atan2(tx - fx, -(tz - fz));

const shot = async (name, fx, fz, tx, tz, pitch = -0.12) => {
  const gy = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [fx, fz]);
  await p.evaluate(([x, z, yaw, g, pi]) => window.__ct.warp(x, z, yaw, g, pi),
    [fx, fz, look(fx, fz, tx, tz), gy, pitch]);
  await waitPainted(p, { frames: 3 });
  const png = await p.screenshot({ path: `shots/${name}.png` });
  const bf = await blackFraction(p, png);
  console.log(`  shots/${name}.png   from (${fx}, ${fz}) toward (${tx}, ${tz})  black ${(bf * 100).toFixed(1)}%`);
  if (bf > 0.9) bad(`${name} is ${(bf * 100).toFixed(0)}% black — you photographed the void, not the world`);
  return bf;
};

console.log(`THRIFT door at (${D.x.toFixed(2)}, ${D.z.toFixed(2)})\n`);
// The crate's old spot, from up the pavement looking down it — this is the
// frame the user's complaint is about.
await shot(`w77-thrift-frontage-${TAG}`, -6.0, -54.0, -6.12, -58.20);
// and from the other side, so a piece hiding behind the camera cannot
await shot(`w77-thrift-frontage-rev-${TAG}`, -6.0, -63.0, -6.12, -58.20);
// the doorway itself, from where a player stands to use it
await shot(`w77-thrift-door-${TAG}`, D.x + 0.6, D.z + 2.2, D.x, D.z, -0.05);
// the alley, from the mouth — where the crate now lives
await shot(`w77-alley-crate-${TAG}`, -7.6, -39.6, -9.0, -37.6, -0.10);
// THE CAT'S OWN APPROVED VIEWPOINT, ct/cat.ts:258 — (-8.5, -39.5) yaw -0.785.
// Aimed by yaw, not by target, because reproducing that exact frame is the point.
{
  const gy = await p.evaluate(() => window.__ct.groundAt(-8.5, -39.5));
  await p.evaluate(([g]) => window.__ct.warp(-8.5, -39.5, -0.785, g, -0.10), [gy]);
  await waitPainted(p, { frames: 3 });
  const png = await p.screenshot({ path: `shots/w77-cat-frame-${TAG}.png` });
  const bf = await blackFraction(p, png);
  console.log(`  shots/w77-cat-frame-${TAG}.png   the cat frame, (-8.5, -39.5) yaw -0.785  black ${(bf * 100).toFixed(1)}%`);
  if (bf > 0.9) bad('the cat frame is black');
}

// ── WALK THE FRONTAGE ────────────────────────────────────────────────────
// Not a warp. Drive the rig with the keyboard down the west pavement past the
// THRIFT door and back, and report where it got to.
// ALWAYS 'w', and the YAW carries the direction. The first version of this
// paired key 's' with yaw PI and double-negated: he walked from z -66 to -86.8,
// twenty metres the wrong way, and the run still printed "covered 20.81 m".
// A walk that reports distance without reporting which way is not a check.
const walk = async (lane, fromZ, toZ) => {
  const south = toZ < fromZ;               // -z is south on this street
  const keyName = 'w';
  const gy = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [lane, fromZ]);
  await p.evaluate(([x, z, yaw, g]) => window.__ct.warp(x, z, yaw, g, 0),
    [lane, fromZ, south ? 0 : Math.PI, gy]);
  await waitPainted(p, { frames: 2 });
  const start = await p.evaluate(() => window.__ct.pos());
  await p.keyboard.down(keyName);
  const path = [];
  for (let i = 0; i < 60; i++) {
    await p.waitForTimeout(100);
    const q = await p.evaluate(() => window.__ct.pos());
    path.push([+q[0].toFixed(2), +q[2].toFixed(2)]);
    if (south ? q[2] <= toZ : q[2] >= toZ) break;
  }
  await p.keyboard.up(keyName);
  const end = await p.evaluate(() => window.__ct.pos());
  const moved = Math.abs(end[2] - start[2]);
  // did he get stuck? a stall is >=8 consecutive samples that move < 2 cm
  let stall = 0, worstStall = 0, stallAt = null;
  for (let i = 1; i < path.length; i++) {
    const d = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    stall = d < 0.02 ? stall + 1 : 0;
    if (stall > worstStall) { worstStall = stall; stallAt = path[i]; }
  }
  // SIGNED, so a leg that walked the wrong way cannot read as success
  const progress = south ? start[2] - end[2] : end[2] - start[2];
  return { start: [+start[0].toFixed(2), +start[2].toFixed(2)],
    end: [+end[0].toFixed(2), +end[2].toFixed(2)], moved: +moved.toFixed(2),
    progress: +progress.toFixed(2), samples: path.length, worstStall, stallAt,
    minX: Math.min(...path.map((q) => q[0])), maxX: Math.max(...path.map((q) => q[0])) };
};

// TWO LANES. x -6.0 is the middle of the walk; x -6.55 is the building-line
// lane the crate used to stand in, which is the one the complaint is about.
// The middle lane alone would pass whatever is against the wall.
const LEGS = [
  ['x -6.00, south-bound', -6.00, -52.0, -66.0],
  ['x -6.00, north-bound', -6.00, -66.0, -52.0],
  ['x -6.55, south-bound', -6.55, -52.0, -66.0],
  ['x -6.55, north-bound', -6.55, -66.0, -52.0],
];
console.log('\nwalking the west pavement past the THRIFT door (14 m of frontage):');
const legs = [];
for (const [nm, lane, a, c] of LEGS) {
  const r2 = await walk(lane, a, c);
  legs.push([nm, r2]);
  console.log(`  ${nm}  ${JSON.stringify(r2.start)} -> ${JSON.stringify(r2.end)}  progress ${r2.progress} m in ${r2.samples} samples, longest stall ${r2.worstStall}${r2.stallAt ? ` at ${JSON.stringify(r2.stallAt)}` : ''}, x ${r2.minX.toFixed(2)}..${r2.maxX.toFixed(2)}`);
}
// POPULATION FLOOR: a walk that never moved must FAIL, not pass quietly.
if (legs.some(([, r2]) => r2.samples < 5)) bad('a leg produced fewer than 5 samples — nothing was measured');
const short = legs.filter(([, r2]) => r2.progress < 12);
if (short.length) bad(`${short.length} leg(s) did not cover the 14 m frontage: ` +
  short.map(([nm, r2]) => `${nm} ${r2.progress} m`).join('; '));
else ok(`all ${legs.length} legs covered the frontage (${legs.map(([, r2]) => r2.progress).join(', ')} m)`);
// WEDGED means he never got there. A pause is not a wedge on a street with
// twelve moving citizens in the collider set, and the x -6.55 lane pauses for
// ~1.3 s around z -63 in BOTH directions — measured identically with the crate
// present (13 samples at z -63.88) and absent (13 at z -64.00), so it is not
// this change and it is not litter, which carries no collider at all. It is
// reported, never swallowed; the failure is only a leg that did not arrive.
const stuck = legs.filter(([, r2]) => r2.worstStall >= 8);
if (stuck.length) console.log(`  NOTE  paused >= 0.8 s on ${stuck.map(([nm, r2]) => `${nm} at z ${r2.stallAt[1]}`).join('; ')} — every leg still arrived`);
const wedged = legs.filter(([, r2]) => r2.worstStall >= 8 && r2.progress < 12);
if (wedged.length) bad(`wedged on ${wedged.map(([nm]) => nm).join(', ')} — stalled AND did not arrive`);
else ok(`nothing wedged: every leg arrived (longest pause ${Math.max(...legs.map(([, r2]) => r2.worstStall))} samples)`);

// NEGATIVE CASE for the walk: holding no key must NOT look like a walk.
{
  const gy = await p.evaluate(() => window.__ct.groundAt(-6.0, -52.0));
  await p.evaluate(([g]) => window.__ct.warp(-6.0, -52.0, 0, g, 0), [gy]);
  await waitPainted(p, { frames: 2 });
  const a = await p.evaluate(() => window.__ct.pos());
  await p.waitForTimeout(1200);
  const c = await p.evaluate(() => window.__ct.pos());
  const drift = Math.hypot(c[0] - a[0], c[2] - a[2]);
  if (drift > 0.2) bad(`NEGATIVE CASE: he moved ${drift.toFixed(2)} m with no key held — the walk numbers above mean nothing`);
  else ok(`negative case: ${drift.toFixed(3)} m of drift with no key held — the walk is the keypress`);
}

console.log(`\n${fails ? `FAIL — ${fails} problem(s)` : 'PASS'}`);
await b.close();
process.exit(fails ? 1 : 0);
