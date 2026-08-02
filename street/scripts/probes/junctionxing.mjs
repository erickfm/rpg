// THE JUNCTION CROSSINGS: are they square, kerb to kerb, and do the ramps land
// where the paint does?
//
// The desk's four requirements are each a number, so each is checked as one
// rather than judged from a screenshot:
//
//   · square to the kerb line, spanning the FULL carriageway, kerb to kerb
//   · aligned with the kerb ramps
//   · set back to where the kerb is genuinely parallel (past the corner arc)
//   · worn, not fresh
//
// And the removal: the east-end crossing must be GONE, and the two legitimate
// ones must not have been taken with it.
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { goto, settle } from '../lib/reachable.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4279/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1034, height: 757 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

const r = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const xings = [];
  let kerb = null;
  s.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    if (n.userData.groundProp === 'crossing stripes') {
      n.geometry.computeBoundingBox();
      const w = n.geometry.boundingBox.clone().applyMatrix4(n.matrixWorld);
      const m = Array.isArray(n.material) ? n.material[0] : n.material;
      const img = m.map.image;
      const cv = document.createElement('canvas');
      cv.width = img.width; cv.height = img.height;
      cv.getContext('2d').drawImage(img, 0, 0);
      const d = cv.getContext('2d').getImageData(0, 0, img.width, img.height).data;
      let sum = 0, n2 = 0, peak = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 128) continue;
        sum += d[i]; n2++; peak = Math.max(peak, d[i]);
      }
      xings.push({ x: [+w.min.x.toFixed(2), +w.max.x.toFixed(2)],
                   z: [+w.min.z.toFixed(2), +w.max.z.toFixed(2)],
                   tex: `${img.width}x${img.height}`,
                   meanWhite: +(sum / Math.max(1, n2)).toFixed(1), peakWhite: peak });
    }
    // the kerb face sheet, for the reveal profile
    const m = Array.isArray(n.material) ? n.material[0] : n.material;
    if (m?.map?.image && m.map.image.width === 768 && m.map.image.height === 10) kerb = n;
  });
  // reveal profile: the top edge of the kerb face, by position
  const prof = [];
  if (kerb) {
    const pos = kerb.geometry.attributes.position;
    const seen = new Map();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y < -0.03) continue;
      const k = `${pos.getX(i).toFixed(2)}|${pos.getZ(i).toFixed(2)}`;
      if (!seen.has(k)) seen.set(k, { x: +pos.getX(i).toFixed(2), z: +pos.getZ(i).toFixed(2), y: +y.toFixed(4) });
    }
    prof.push(...seen.values());
  }
  return { xings, prof };
});

console.log(`\n── painted crossings in the world: ${r.xings.length} ──`);
for (const q of r.xings) {
  const w = (q.x[1] - q.x[0]).toFixed(2), d = (q.z[1] - q.z[0]).toFixed(2);
  console.log(`  x ${q.x[0]}..${q.x[1]} (${w} m)   z ${q.z[0]}..${q.z[1]} (${d} m)   ${q.tex}` +
    `   white mean ${q.meanWhite} peak ${q.peakWhite}`);
}
const east = r.xings.some((q) => q.x[0] > 50);
console.log(`  the DEAD EAST END crossing (x > 50): ${east ? 'STILL THERE  <-- not removed' : 'gone'}`);

// kerb to kerb, and the ramps
const near = (arr, x, z, tol = 0.35) => arr.filter((q) => Math.abs(q.x - x) < tol && Math.abs(q.z - z) < tol);
const at = (x, z) => {
  const c = near(r.prof, x, z);
  return c.length ? Math.min(...c.map((q) => q.y)) : null;
};
console.log(`\n── the kerb where each crossing lands (full reveal is 0.110 at the face top) ──`);
for (const [name, x, z] of [
  ['A west end  (-5.0, -90.2)', -5.0, -90.2],
  ['A east end  ( 5.0, -90.2)', 5.0, -90.2],
  ['A, 3 m away (-5.0, -93.5)', -5.0, -93.5],
  ['B north end (10.6,  -98 )', 10.6, -98],
  ['B south end (10.6, -108 )', 10.6, -108],
  ['B, 3 m away (14.0,  -98 )', 14.0, -98],
]) {
  const y = at(x, z);
  console.log(`  ${name}   kerb top ${y === null ? '(no vertex within 0.35 m)' : y.toFixed(4)}` +
    (y !== null && y < 0.05 ? '   RAMPED' : y !== null ? '   full height' : ''));
}

for (const [name, x, z, yaw, pitch, hour] of [
  ['A-from-walk', -6.0, -87.5, 0, -0.16, 22],
  ['A-day', -6.0, -87.5, 0, -0.16, 13],
  ['B-from-walk', 10.6, -95.6, 0, -0.16, 22],
  ['B-day', 10.6, -95.6, 0, -0.16, 13],
  ['corner-day', 9.0, -86.0, 0.55, -0.22, 13],
  // z -111 is BEHIND the south walk's back edge, i.e. inside the building —
  // the walk runs -110..-108. Stand on it, not through it.
  ['east-end-day', 53.8, -109.2, Math.PI, -0.14, 13],
]) {
  await p.evaluate(([h]) => window.__ct.clock(h, 30), [hour]);
  await p.evaluate(([X, Z, Y, P]) => window.__ct.warp(X, Z, Y, 0.14, P), [x, z, yaw, pitch]);
  const lum = await settle(p);
  const f = `shots/jx-${name}.png`;
  await p.screenshot({ path: f });
  console.log(`  ${f.padEnd(30)} mean ${lum.toFixed(4)}${lum < 0.02 ? '  <-- BLACK' : ''}`);
}
// ── AND WALK BOTH OF THEM, because the kerb now drops where the paint is and
// a ramp is a floor change. GOTCHAS: anything touching movement or floors gets
// walked, not screenshotted.
await p.evaluate(() => window.__ct.clock(13, 30));
const posNow = () => p.evaluate(() => window.__ct.pos().slice(0, 3).map((v) => +v.toFixed(2)));
const cross = async (name, x, z, yaw, stop) => {
  await p.evaluate(([X, Z, Y]) => window.__ct.warp(X, Z, Y, 0.14, 0), [x, z, yaw]);
  await settle(p);
  await p.keyboard.down('w');
  let last = await posNow(), worst = 0, stuck = 0, lowest = 9, highest = -9;
  for (let i = 0; i < 160; i++) {
    await p.waitForTimeout(100);
    const now = await posNow();
    lowest = Math.min(lowest, now[1]); highest = Math.max(highest, now[1]);
    const moved = Math.hypot(now[0] - last[0], now[2] - last[2]);
    if (moved < 0.02 && i > 2) { stuck++; worst = Math.max(worst, stuck); } else stuck = 0;
    last = now;
    if (stop(now)) break;
  }
  await p.keyboard.up('w');
  console.log(`  ${name.padEnd(22)} ended ${JSON.stringify(last)}  eye ${lowest.toFixed(2)}..${highest.toFixed(2)}` +
    `  longest stall ${(worst * 0.1).toFixed(1)} s${stop(last) ? '   CROSSED' : '   <-- DID NOT GET ACROSS'}`);
};
console.log('\n── walked ──');
await cross('A, east kerb -> west', 6.0, -90.2, -Math.PI / 2, (q) => q[0] < -5.6);
await cross('B, north kerb -> south', 10.6, -97.0, 0, (q) => q[2] < -108.6);
await b.close();
