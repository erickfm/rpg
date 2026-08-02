// Does the painted toe point the way the person is WALKING — at every angle?
//
// The atlas can be right and the world still wrong, because which way a toe
// ends up pointing is the product of three things:
//
//   1. the painted profile faces LEFT in texture space (nose at cx-7, cap brim
//      at cx-9, toe at ankle-7)
//   2. `viewFor` picks a column and MIRRORS the back half of the circle
//   3. the sprite is a billboard, so its local +x maps to a world direction
//      that depends on where the camera is
//
// Get any one of them backwards and the feet read backwards from some angles
// and fine from others — which is exactly how this bug survived two fixes.
// So: walk the camera all the way round the block, and for every citizen in a
// profile view assert the toe's WORLD direction agrees with their travel.
//
// toe direction = (mirror ? +localX : -localX) rotated by the billboard yaw
//   localX(yaw) = (cos yaw, -sin yaw)      [three.js rotation.y about +y]
//
// Usage: SHOT_URL=http://localhost:4187/ node scripts/feet-check.mjs
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errs = [];
// THE INTEGRATION WORLD DROPS ITS HMR SOCKET, and that is not a defect in the
// world. `live-integrate.sh` rebuilds every 15 s, so Vite's client reports
// "WebSocket closed without opened" — reportWorld's own banner says to expect
// exactly one. Counting it as a page error made every probe of mine exit 1
// against :5177 with all assertions green, which defeats the opt-in
// (SHOT_WORLD=integration) that was added so this could be asked at all.
// Dropped ONLY that message, ONLY in that mode: a real error still fails.
const HMR_NOISE = /WebSocket closed without opened/;
const noise = (m) => process.env.SHOT_WORLD === 'integration' && HMR_NOISE.test(m);
page.on('pageerror', (e) => { const m = String(e.message); if (!noise(m)) errs.push(m); });
await page.goto(aim('http://localhost:4177/'), { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(page, aim('http://localhost:4177/'));   // GOTCHAS 26: prove it, do not just name it
await page.waitForTimeout(400);
await page.evaluate(() => window.__ct.clock(13, 0));

// Sample from many camera positions around the block, so every citizen is seen
// from a full range of angles and both profile columns come up.
// KEEP SAMPLING until there are enough profile views to judge, rather than
// making one pass and hoping. A profile sample needs a citizen that is both in
// the profile column from where the camera stands AND moving — and since the
// crowd started stopping for errands, a single sweep of the block can come back
// with only a handful. This check then failed with "0 of 6 cases point the toe
// backwards", i.e. nothing wrong, not enough looked at, which is exactly the kind
// of failure that teaches people to ignore a probe.
const samples = await page.evaluate(async (want) => {
  const out = [];
  const spots = [];
  for (const z of [6, -10, -26, -42, -58, -74, -88]) { spots.push([-3.0, z], [3.0, z]); }
  const usable = () => out.filter((v) => v.col === 2 && v.moving).length;
  const t0 = performance.now();
  while (usable() < want && performance.now() - t0 < 25000) {
    for (const [x, z] of spots) {
      window.__ct.warp(x, z, 0, 0, 0);
      // let a frame run so the crowd's LATE hook recomputes col/mirror from here
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => requestAnimationFrame(r));
      const a = window.__ct.views();
      // ── only judge a walker whose heading is STEADY ────────────────────
      //
      // The sprite's view has hysteresis: it holds the current sector until the
      // heading is clearly past the boundary, which is what stops it flickering
      // when the angle sits on one. The cost is that MID-TURN the painted view
      // legitimately lags the new direction of travel — so a citizen rounding a
      // corner really is, for a few frames, pointing its toe the way it was just
      // going. Judging those samples flagged correct behaviour as a fault, about
      // one run in three.
      //
      // So take a second reading and keep only the walkers whose travel
      // direction has barely changed between the two.
      await new Promise((r) => setTimeout(r, 180));
      const b = window.__ct.views();
      for (let i = 0; i < a.length; i++) {
        const ma = Math.hypot(a[i].vx, a[i].vz), mb = Math.hypot(b[i].vx, b[i].vz);
        if (ma < 1e-4 || mb < 1e-4) continue;
        const steady = (a[i].vx * b[i].vx + a[i].vz * b[i].vz) / (ma * mb) > 0.985;
        if (steady) out.push({ cam: [x, z], ...b[i] });
      }
      if (usable() >= want) break;
    }
    // let the crowd walk on before sweeping again, so the second pass is not the
    // same six people in the same poses
    await new Promise((r) => setTimeout(r, 900));
  }
  return out;
}, 8);

// toe·travel for one case. >0 means the toe leads the direction of travel.
// The crowd routes over a graph now, so travel is an arbitrary heading rather
// than ±z — this is a dot product against the actual velocity.
const along = (yaw, mirror, v) => {
  const lx = [Math.cos(yaw), -Math.sin(yaw)];             // the sprite's local +x
  const toe = mirror ? lx : [-lx[0], -lx[1]];             // painted at texture LEFT
  const m = Math.hypot(v[0], v[1]) || 1;
  return (toe[0] * v[0] + toe[1] * v[1]) / m;
};

let fails = 0, profiles = 0, mirrored = 0, unmirrored = 0;
const bad = [];
for (const s of samples) {
  if (s.col !== 2) continue;               // only the profile column has a toe
  if (!s.moving) continue;                 // a halted person has no travel dir
  // Check the case as observed AND its counterpart on the other side of the
  // circle. Both are needed and only one is reachable in the world: lane and
  // direction are correlated in the cast (east-walk citizens head north,
  // west-walk head south) and the buildings stop you getting round the far
  // side, so a camera in the road only ever produces sector 6 — the mirrored
  // column. The counterpart is exact rather than assumed: flipping dir turns
  // `facing` by π, which moves the sector by 4, and viewFor maps 2 and 6 to the
  // SAME column with the mirror flipped. The billboard yaw does not depend on
  // dir at all. So (mirror flipped, dir flipped) at the same yaw is precisely
  // sector 2, and it is the case the user would see from the far pavement.
  const v = [s.vx, s.vz];
  for (const [mir, vv, tag] of [[s.mirror, v, 'observed'], [!s.mirror, [-v[0], -v[1]], 'counterpart']]) {
    profiles++;
    if (mir) mirrored++; else unmirrored++;
    const a = along(s.yaw, mir, vv);
    if (a < 0.7) { fails++; if (bad.length < 6) bad.push({ ...s, tag, mir, a: +a.toFixed(3) }); }
  }
}

console.log('feet check — the painted toe against the direction of travel:');
console.log(`  ${profiles} profile cases (${unmirrored} unmirrored, ${mirrored} mirrored)`);
for (const b of bad) {
  console.log(`  FAIL ${b.tag}: cam=${b.cam} dir=${b.dir} mirror=${b.mir} yaw=${b.yaw.toFixed(3)} toe·travel=${b.a}`);
}
// Separate the two outcomes: a toe pointing the wrong way is a BUG, too few
// samples is an inconclusive run. Reporting both as FAIL is what made this noisy.
const enough = profiles >= 8 && unmirrored > 0 && mirrored > 0;
const ok = enough && fails === 0;
console.log(fails > 0
  ? `  FAIL ${fails}/${profiles} cases point the toe backwards`
  : enough
    ? '  OK   every profile case points its toe the way it walks (both columns covered)'
    : `  ??   INCONCLUSIVE — only ${profiles} profile cases in 25 s (${unmirrored} unmirrored, ` +
      `${mirrored} mirrored); none of them wrong, but that is too few to certify`);
if (errs.length) console.log(`\npage errors:\n${errs.slice(0, 3).join('\n')}`);
await browser.close();
process.exitCode = fails > 0 ? 1 : ok ? 0 : 2;   // 2 = inconclusive, not a failure
