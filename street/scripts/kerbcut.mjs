// feat/ground — the car lot's curb cut: does it MEASURE and does it WALK?
//
// Renamed from curbcut.mjs. That name collided with a screenshot script builder
// C added for the same feature, and on a rebase mine lost — silently, because a
// script that is gone does not fail, it just stops being run. A mutation test
// found it: I removed the entire curb cut from ct/tex-ground.ts and nothing in
// the suite noticed. C's takes the pictures; this one takes the measurements,
// and the two do not overlap, so both should exist under names that do not
// fight.
//
// A curb cut is the one detail on this street that has to work as GEOMETRY and
// as GROUND at the same time: it must look like the kerb drops, and the player
// (and anything else that reads gy) must actually be able to go up and over it.
// So this measures the profile and then walks it.
//
// Usage: SHOT_URL=http://localhost:4279/ node scripts/curbcut.mjs
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(page, process.env.SHOT_URL ?? 'http://localhost:4177/');   // GOTCHAS 26: prove it, do not just name it
await page.evaluate(() => window.__ct.clock(13, 0));
await page.waitForTimeout(900);

// the cut, as declared: east kerb, centred z = 2.6, opening 6.8 m, flares 0.9
const CZ = 2.6, HW = 3.4, F = 0.9;
// These three are a REMEMBERED COORDINATE, which ct/lot.ts:1617 warns about in
// as many words: "from outside the scene graph you cannot tell whose a mesh is,
// so a whole-world checker has to be handed a BOX, and a box is a remembered
// coordinate." Every sample below is taken relative to them, so if the cut ever
// moves — it is derived from the lot's AISLE_HW, which is C's — this script
// would sample uncut kerb at z 2.6, find full reveal there, and report a
// missing cut; or worse, if the window still clipped part of a moved cut, pass
// on the wrong stretch. So the declaration is CROSS-CHECKED against where the
// kerb is actually down, further below, rather than trusted.
// 1. THE KERB-TOP PROFILE, read off the built geometry.
//
// The first version of this warped along the kerb and read pos()[3], which is
// the rig's ground height — and warp does not RESOLVE the ground, it only
// stores what you pass it. So it reported 0.000 the whole way and would have
// reported 0.000 for a kerb that was never cut at all. Measure the mesh.
const prof = await page.evaluate(({ CZ, HW, F }) => {
  const sc = window.__ct.scene();
  const bins = new Map();
  sc.traverse((o) => {
    const g = o.geometry;
    if (!o.isMesh || !g?.attributes?.position || g.type !== 'BufferGeometry') return;
    const pa = g.attributes.position.array;
    for (let i = 0; i < pa.length; i += 3) {
      const x = pa[i], y = pa[i + 1], z = pa[i + 2];
      if (Math.abs(x - 5.0) > 0.02) continue;              // the kerb line itself
      if (z < CZ - (HW + F + 2) || z > CZ + (HW + F + 2)) continue;
      const k = Math.round((z - CZ) * 5) / 5;
      bins.set(k, Math.max(bins.get(k) ?? -9, y));
    }
  });
  return [...bins.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => [k, +v.toFixed(4)]);
}, { CZ, HW, F });
const at = (dz) => { let best = null, bd = 9;
  for (const [k, v] of prof) if (Math.abs(k - dz) < bd) { bd = Math.abs(k - dz); best = v; }
  return best; };
// These vertices are the top of the kerb's VERTICAL FACE, not the top of the
// kerb: the chamfered arris rises from here to KERB_H over the next 6.25 cm.
// rise(0.140) is 0.030, so a full-reveal face tops out at 0.110 and a
// 0.035 lip at 0.021. Comparing against 0.140 failed a correct kerb.
const FACE_TOP = 0.140 - 0.030;
console.log(`\n  kerb-top height across the cut, from the mesh (${prof.length} samples, full-reveal face top is ${FACE_TOP}):`);
console.log('   ' + prof.filter((_, i) => i % 3 === 0).map((p) => `${p[0]}:${p[1].toFixed(3)}`).join('  '));
const mid = at(0), out1 = at(-(HW + F + 1.5)), out2 = at(HW + F + 1.5);
console.log(`\n  ${mid !== null && mid < 0.06 ? 'OK  ' : 'FAIL'} the kerb is DOWN across the opening (${mid?.toFixed(3)} m)`);
const full = out1 > FACE_TOP - 0.005 && out2 > FACE_TOP - 0.005;
console.log(`  ${full ? 'OK  ' : 'FAIL'} full reveal returns outside the flares (${out1?.toFixed(3)} / ${out2?.toFixed(3)})`);
if (!full) process.exitCode = 1;
let steps = 0;
for (let i = 1; i < prof.length; i++) if (Math.abs(prof[i][1] - prof[i - 1][1]) > 0.05) steps++;
console.log(`  ${steps === 0 ? 'OK  ' : 'FAIL'} it RAMPS rather than stepping (${steps} jumps > 5 cm)`);

// IS THE CUT WHERE THE SCRIPT WAS TOLD IT IS? Measure it: the down-kerb run is
// every bin whose face top is below half the full reveal. Its centre and half
// width must agree with CZ and HW, or every measurement above was taken on a
// stretch of kerb chosen from memory.
const down = prof.filter(([, v]) => v < FACE_TOP / 2).map(([k]) => k);
if (!down.length) {
  console.log(`\n  FAIL no down-kerb found anywhere in the sampled window — there is no cut here`);
  process.exitCode = 1;
} else {
  const lo = Math.min(...down), hi = Math.max(...down);
  const mZ = CZ + (lo + hi) / 2, mHW = (hi - lo) / 2;
  // Tolerance is one bin (0.2 m) on the centre, and the flares mean the
  // measured half-width lands a little inside HW rather than on it.
  const placed = Math.abs(mZ - CZ) <= 0.2 && Math.abs(mHW - HW) <= F + 0.2;
  console.log(`\n  measured cut: centre z ${mZ.toFixed(2)}, half-width ${mHW.toFixed(2)} m ` +
    `(declared ${CZ} / ${HW})`);
  console.log(`  ${placed ? 'OK  ' : 'FAIL'} the cut is where this script was told it is`);
  if (!placed) process.exitCode = 1;
}

// 2. WALK IT — in off the road, across the apron, into the lot
const hike = async (label, x, z, yaw, secs, axis) => {
  await page.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, undefined, 0), [x, z, yaw]);
  await page.waitForTimeout(150);
  const a = await page.evaluate(() => window.__ct.pos());
  await page.keyboard.down('w'); await page.waitForTimeout(secs * 1000); await page.keyboard.up('w');
  const b = await page.evaluate(() => window.__ct.pos());
  const moved = Math.abs(axis === 'x' ? b[0] - a[0] : b[2] - a[2]);
  const ok = moved > secs * 1.6;
  console.log(`  ${ok ? 'OK  ' : 'STUCK'} ${label}: ${moved.toFixed(1)} m ` +
    `(${a[0].toFixed(1)},${a[2].toFixed(1)}) -> (${b[0].toFixed(1)},${b[2].toFixed(1)}) gy ${b[3].toFixed(3)}`);
  return ok;
};
await page.mouse.click(450, 280);
console.log('\n  walking the cut:');
let all = true;
// Start in the PARKING lane, not the travel lane. At x = 3.6 the walker is
// standing in traffic and a passing car shoves them sideways, which made this
// pass at 19.6 m on one run and fail at 6.4 m on the next — a flaky test that
// was measuring the bus timetable.
all = await hike('off the road, up the cut, into the lot', 4.6, CZ, Math.PI / 2, 6, 'x') && all;
all = await hike('back out of the lot to the road', 9.5, CZ, -Math.PI / 2, 6, 'x') && all;
// and the walk still runs past it, over the apron
all = await hike('the pavement still runs THROUGH the cut', 6.4, CZ - 6.5, Math.PI, 6, 'z') && all;
// CONTROL. The walk-in above only means something if it FAILS somewhere there
// is no cut — otherwise it is measuring that the player can step up a kerb
// anywhere, and would pass on a lot with no entrance at all.
console.log('\n  control — the same walk 9 m north, where the kerb is full height:');
await hike('walk in where there is NO cut', 4.6, CZ + 9.0, Math.PI / 2, 6, 'x');

const shot = async (n, x, z, tx, tz, gy, p2) => {
  await page.evaluate(([x, z, tx, tz, gy, p2]) =>
    window.__ct.warp(x, z, Math.atan2(tx - x, -(tz - z)), gy, p2), [x, z, tx, tz, gy, p2]);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `shots/cc-${n}.png` });
};
await shot('road', 1.2, CZ, 7.0, CZ, 0, -0.10);
await shot('along', 5.9, CZ - 9.0, 5.9, CZ + 6.0, 0.14, -0.16);
await shot('lot', 12.0, CZ + 0.4, 2.0, CZ - 0.6, 0.14, -0.08);
await browser.close();
if (errors.length) { console.error('\nPAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
if (!all) { console.error('\nCURB CUT NOT PASSABLE'); process.exit(1); }
console.log('\nno page errors');
