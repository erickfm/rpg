// WALK IT. Item 221 — is the lot's north flank solid, and are the park's?
//
// `openSite` (ct/street.ts) draws each site's two flank PARTY WALLS as bare
// PlaneGeometry and registers NO collider for them. Whether that matters
// depends on whether a neighbouring shell happens to stand behind each flank,
// which is a different question per flank — so this walks all four rather than
// reasoning about them.
//
// A walk, not a raycast: BUILDER-BRIEF §10.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4350/');
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 900, height: 600 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await page.evaluate(() => window.__ct.clock(13, 0));

const floors = await page.evaluate(() => {
  const out = [];
  const sc = window.__ct.scene(); sc.updateMatrixWorld(true);
  sc.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox; if (!bb) return;
    let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
    const e = o.matrixWorld.elements;
    for (let i = 0; i < 8; i++) {
      const vx = i & 1 ? bb.max.x : bb.min.x, vy = i & 2 ? bb.max.y : bb.min.y, vz = i & 4 ? bb.max.z : bb.min.z;
      const X = e[0] * vx + e[4] * vy + e[8] * vz + e[12];
      const Y = e[1] * vx + e[5] * vy + e[9] * vz + e[13];
      const Z = e[2] * vx + e[6] * vy + e[10] * vz + e[14];
      mnx = Math.min(mnx, X); mxx = Math.max(mxx, X); mny = Math.min(mny, Y);
      mxy = Math.max(mxy, Y); mnz = Math.min(mnz, Z); mxz = Math.max(mxz, Z);
    }
    if (mxy - mny > 0.6) return;
    if (mxx - mnx < 1 || mxz - mnz < 1) return;
    out.push({ minX: mnx, maxX: mxx, minZ: mnz, maxZ: mxz, y: mxy });
  });
  return out;
});
const EDGE = 0.25, LO = 0.9, HI = 1.2;
const hasFloor = (x, z, gy) => floors.some((f) =>
  x >= f.minX - EDGE && x <= f.maxX + EDGE && z >= f.minZ - EDGE && z <= f.maxZ + EDGE
  && f.y >= gy - LO && f.y <= gy + HI);
const groundAt = (x, z) => page.evaluate(([x, z]) => window.__ct.groundAt(x, z), [x, z]);

// SELF-TEST BOTH SIGNS before believing a single leg (the predicate is copied
// from scripts/w75-site-contained.mjs, which is the registered check).
{
  const bad = [];
  if (floors.length < 100) bad.push(`only ${floors.length} floor meshes`);
  if (!hasFloor(0, 0, await groundAt(0, 0))) bad.push('middle of the road reads VOID');
  if (hasFloor(0, -170, await groundAt(0, -170))) bad.push('60 m off-world reads FLOORED');
  if (bad.length) { console.log('PREDICATE CONTROLS FAILED: ' + bad.join('; ')); await b.close(); process.exit(3); }
  console.log(`predicate ok: ${floors.length} floor meshes, road solid, off-world void`);
}

const walk = async (x, z, yaw, ms = 1600, label = '') => {
  await page.evaluate(([x, z, yaw]) =>
    window.__ct.warp(x, z, yaw, window.__ct.groundAt(x, z) ?? 0.14, 0), [x, z, yaw]);
  await page.waitForTimeout(120);
  const start = await page.evaluate(() => window.__ct.pos());
  await page.keyboard.down('w'); await page.waitForTimeout(ms); await page.keyboard.up('w');
  await page.waitForTimeout(90);
  const p = await page.evaluate(() => window.__ct.pos());
  const gy = await groundAt(p[0], p[2]);
  const fl = hasFloor(p[0], p[2], gy);
  const d = Math.hypot(p[0] - start[0], p[2] - start[2]);
  console.log(`${label.padEnd(34)} from (${x},${z}) yaw ${yaw.toFixed(2)} -> `
    + `(${p[0].toFixed(2)}, ${p[2].toFixed(2)})  moved ${d.toFixed(2)} m  ${fl ? 'ON FLOOR' : '*** NO FLOOR ***'}`);
  return { p, fl, d };
};

// SELF-TEST THE WALKER, BOTH SIGNS. A probe that paired `s` with yaw pi and
// walked 20.81 m the wrong way while printing success is on this project's
// board, so the sign is MEASURED here, not assumed: the first cut of this file
// asserted yaw 0 = +z and this control failed it immediately.
const N = Math.PI, S = 0;   // measured below: yaw 0 walks -z, yaw pi walks +z
{
  const a = await walk(0, -20, S, 900, 'control: yaw 0 must walk -z');
  if (a.p[2] >= -20 - 0.5) { console.log('WALKER SELF-TEST FAILED — yaw 0 did not move -z'); await b.close(); process.exit(3); }
  const c = await walk(0, -20, N, 900, 'control: yaw pi must walk +z');
  if (c.p[2] <= -20 + 0.5) { console.log('WALKER SELF-TEST FAILED — yaw pi did not move +z'); await b.close(); process.exit(3); }
}
console.log('\n── the LOT north flank (z 14.2), from inside the lot ──');
for (const x of [8, 10, 12, 15, 18, 21, 24, 27, 29.5]) await walk(x, 11.5, N, 1800, `lot -> north at x=${x}`);

console.log('\n── the LOT south flank (z -9), from inside the lot ──');
for (const x of [8, 12, 18, 24, 29.5]) await walk(x, -6.5, S, 1800, `lot -> south at x=${x}`);

console.log('\n── the PARK flanks (z -68 north, z -98 south) ──');
for (const x of [-9, -14, -20, -26, -32, -37]) await walk(x, -70.5, N, 1800, `park -> north at x=${x}`);
for (const x of [-9, -14, -20, -26, -32, -37]) await walk(x, -95.5, S, 1800, `park -> south at x=${x}`);

console.log('\n── the WEST side of the street at the north end ──');
for (const x of [-6, -8, -12, -20, -30]) await walk(x, 12.0, N, 1800, `west -> north at x=${x}`);

await b.close();
