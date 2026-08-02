// feat/parking — how well the parked cars are parked is DRAWN, not authored.
//
//   probe (default) — this session's actual arrangement, and the hard guards
//   dist            — what the distribution produces over many draws, since
//                     one seeded session only ever shows you one sample of it
//   shots           — look at the row
//
// Usage: SHOT_URL=http://localhost:4279/ node scripts/parking.mjs [probe|dist|shots|all]
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { flags } from '../lib/args.mjs';

// An unrecognised mode matched no branch, ran nothing and exited 0 — the
// same shape as an ignored flag, and `lib/args.mjs` has had `opts.modes`
// for it since 05694164a. Adopting rather than re-solving it.
const mode = flags([], process.argv.slice(2), { modes: ['dist', 'probe', 'shots', 'all'] })
  .rest[0] ?? 'probe';

if (mode === 'dist' || mode === 'all') {
  // Replicates ct/rng.ts's LCG and the draw in crosstown.ts, so we can see the
  // shape of the spread rather than the single arrangement this seed happens
  // to give. Keep in step with parkGap/parkYaw if those change.
  let seed = 9797 >>> 0;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const parkGap = (c) => c === 'perfect' ? rnd() * 0.05
    : c === 'ordinary' ? 0.05 + rnd() * 0.12 : 0.17 + rnd() * 0.14;
  const parkYaw = (c) => {
    const s = rnd() < 0.5 ? -1 : 1;
    return s * (c === 'perfect' ? rnd() * 0.012
      : c === 'ordinary' ? 0.012 + rnd() * 0.038 : 0.04 + rnd() * 0.06);
  };
  // Simulate whole ARRANGEMENTS, not individual cars: the point of dealing
  // shuffled classes is what the row looks like as a set.
  const N = 4000;
  let allTidy = 0, hasPerfect = 0, hasOut = 0, maxGap = 0, maxYaw = 0;
  for (let n = 0; n < N; n++) {
    const cls = ['perfect', 'ordinary', 'out'];
    for (let i = cls.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [cls[i], cls[j]] = [cls[j], cls[i]];
    }
    let tidy = 0;
    for (const c of cls) {
      const g = parkGap(c), y = Math.abs(parkYaw(c));
      rnd();                               // the z jitter, to stay in step
      if (g < 0.06 && y < 0.02) tidy++;
      maxGap = Math.max(maxGap, g); maxYaw = Math.max(maxYaw, y);
    }
    if (tidy === 3) allTidy++;
    if (cls.includes('perfect')) hasPerfect++;
    if (cls.includes('out')) hasOut++;
  }
  const pc = (x) => `${((x / N) * 100).toFixed(0)}%`;
  console.log(`\nthe parking spread over ${N} arrangements:`);
  console.log(`  arrangements containing a near-perfect car: ${pc(hasPerfect)}`);
  console.log(`  arrangements containing a well-out car:     ${pc(hasOut)}`);
  console.log(`  arrangements where ALL are tidy (the bug):  ${pc(allTidy)}`);
  console.log(`  worst case gap ${maxGap.toFixed(3)} m, yaw ${maxYaw.toFixed(3)} rad`);
  const perfectHappens = hasPerfect / N > 0.9;
  const neverMachined = allTidy / N < 0.01;
  const gapBounded = maxGap <= 0.31 + 1e-9 && maxYaw <= 0.10 + 1e-9;
  console.log(`  ${perfectHappens ? 'OK  ' : 'FAIL'} perfect parking still happens — a car always gets it`);
  console.log(`  ${neverMachined ? 'OK  ' : 'FAIL'} the row never comes out machined again`);
  console.log(`  ${gapBounded ? 'OK  ' : 'FAIL'} the draw can never exceed the guards`);
  if (!perfectHappens || !neverMachined || !gapBounded) process.exit(1);
}

if (mode === 'probe' || mode === 'shots' || mode === 'all') {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message)));
    await page.goto(aim('http://localhost:4177/'), { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
  await reportWorld(page, aim('http://localhost:4177/'));   // GOTCHAS 26: prove it, do not just name it
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__ct.clock(13, 0));

  if (mode === 'probe' || mode === 'all') {
    const cars = await page.evaluate(() => {
      const out = [];
      window.__ct.scene().traverse((o) => {
        if (!o.isGroup || o.children.length < 4) return;
        if (Math.abs(o.position.x) < 3.0 || Math.abs(o.position.x) > 4.2) return;
        out.push({ x: o.position.x, z: o.position.z, ry: o.rotation.y });
      });
      return out.sort((a, b) => b.z - a.z);
    });
    console.log('\nthis session\'s arrangement:');
    let onWalk = 0, inLane = 0;
    for (const c of cars) {
      const gap = 3.93 - Math.abs(c.x);
      const yaw = Math.abs(((c.ry % Math.PI) + Math.PI + Math.PI / 2) % Math.PI - Math.PI / 2);
      const how = gap < 0.05 ? 'near-perfect' : gap < 0.17 ? 'ordinary' : 'well out';
      console.log(`  z=${c.z.toFixed(1).padStart(6)}  ${Math.abs(c.x) > 0 && c.x > 0 ? 'east' : 'west'} kerb  ` +
        `gap ${(gap * 100).toFixed(0).padStart(2)} cm  yaw ${yaw.toFixed(3)} rad  — ${how}`);
      if (Math.abs(c.x) + 1.05 > 5.0) onWalk++;
      if (Math.abs(c.x) - 1.05 < 2.55) inLane++;
    }
    console.log(`  ${onWalk === 0 ? 'OK  ' : 'FAIL'} no collider reaches the sidewalk`);
    console.log(`  ${inLane === 0 ? 'OK  ' : 'FAIL'} no collider reaches the travel lane`);
    if (onWalk || inLane) process.exit(1);
  }

  if (mode === 'shots' || mode === 'all') {
    const shot = async (n, x, z, tx, tz, gy = 0, p = 0) => {
      await page.evaluate(([x, z, tx, tz, gy, p]) =>
        window.__ct.warp(x, z, Math.atan2(tx - x, -(tz - z)), gy, p), [x, z, tx, tz, gy, p]);
      await page.waitForTimeout(320);
      await page.screenshot({ path: `shots/pk-${n}.png` });
    };
    await shot('row', 0.4, -4, 3.6, -50, 0, -0.06);
    await shot('east-1', 1.2, -8, 3.9, -13, 0, -0.05);
    await shot('west-1', -1.2, -28, -3.8, -33, 0, -0.05);
    await shot('east-2', 1.2, -44, 3.7, -49, 0, -0.05);
    await shot('over', 0, -30, 0, -50, 11, -0.95);
    console.log('shots -> shots/pk-*.png');
  }
  await browser.close();
  if (errors.length) { console.error('\nPAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
}
console.log('\nno page errors');
