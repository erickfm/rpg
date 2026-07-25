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
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message)));
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await page.waitForTimeout(400);
await page.evaluate(() => window.__ct.clock(13, 0));

// Sample from many camera positions around the block, so every citizen is seen
// from a full range of angles and both profile columns come up.
const samples = await page.evaluate(async () => {
  const out = [];
  const spots = [];
  for (const z of [6, -10, -26, -42, -58, -74, -88]) { spots.push([-3.0, z], [3.0, z]); }
  for (const [x, z] of spots) {
    window.__ct.warp(x, z, 0, 0, 0);
    // let a frame run so the crowd's LATE hook recomputes col/mirror from here
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => requestAnimationFrame(r));
    const w = window.__ct.walkers ? null : null;
    for (const v of window.__ct.views()) out.push({ cam: [x, z], ...v });
  }
  return out;
});

// toe·travel for one case. >0 means the toe leads the direction of travel.
const along = (yaw, mirror, dir) => {
  const lx = [Math.cos(yaw), -Math.sin(yaw)];             // the sprite's local +x
  const toe = mirror ? lx : [-lx[0], -lx[1]];             // painted at texture LEFT
  return toe[1] * dir;                                    // they walk along z
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
  for (const [mir, dir, tag] of [[s.mirror, s.dir, 'observed'], [!s.mirror, -s.dir, 'counterpart']]) {
    profiles++;
    if (mir) mirrored++; else unmirrored++;
    const a = along(s.yaw, mir, dir);
    if (a < 0.7) { fails++; if (bad.length < 6) bad.push({ ...s, tag, mir, dir, a: +a.toFixed(3) }); }
  }
}

console.log('feet check — the painted toe against the direction of travel:');
console.log(`  ${profiles} profile cases (${unmirrored} unmirrored, ${mirrored} mirrored)`);
for (const b of bad) {
  console.log(`  FAIL ${b.tag}: cam=${b.cam} dir=${b.dir} mirror=${b.mir} yaw=${b.yaw.toFixed(3)} toe·travel=${b.a}`);
}
const ok = profiles >= 8 && unmirrored > 0 && mirrored > 0 && fails === 0;
console.log(ok
  ? `  OK   every profile case points its toe the way it walks (both columns covered)`
  : `  FAIL ${fails}/${profiles} cases point the toe backwards`);
if (errs.length) console.log(`\npage errors:\n${errs.slice(0, 3).join('\n')}`);
await browser.close();
process.exitCode = ok ? 0 : 1;
