// ITEM 108 — the mug from WHERE THE PLAYER ACTUALLY STANDS.
//
// The item is explicit: "Look at it from where the player stands, not from a
// close orbit … the only test that matters is whether it reads at standing
// distance and height." So the station is flat 301's own SPAWN, read out of
// the world, and the aim is SOLVED rather than typed: the yaw/pitch that put
// the mug in the middle of the frame are found by projecting the mug through
// the real camera and keeping the sign convention that actually centres it.
//
// Every shot declares what it expects to see. A frame whose subject does not
// project inside the viewport is reported as a MISS, not filed as evidence.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w60-mug-shot.mjs <label>
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const label = process.argv[2] ?? 'now';
const URL = aim('http://localhost:4184/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 740 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(13, 30));

// WAIT FOR THE FIRST FRAME, NOT FOR A TIMEOUT. The first version of this probe
// waited 600 ms per station and filed a COMPLETELY BLACK frame for the first
// one — the interior had not drawn yet — while the two later stations, by then
// warmed up, looked fine. A black frame is not evidence of anything, and it is
// exactly the kind of thing that gets read as "the mug is not there".
await p.waitForFunction(() => {
  const c = document.querySelector('canvas'); if (!c) return false;
  const g = document.createElement('canvas'); g.width = 64; g.height = 40;
  const cx = g.getContext('2d'); cx.drawImage(c, 0, 0, 64, 40);
  const d = cx.getImageData(0, 0, 64, 40).data;
  let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2];
  return s / (d.length / 4) / 3 > 8;
}, { timeout: 30000 });

// the mug, found by geometry signature — never by a coordinate I remember
const mug = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  let hit = null;
  s.traverse((n) => {
    if (!n.isMesh || n.geometry?.type !== 'CylinderGeometry') return;
    const gp = n.geometry.parameters;
    if (Math.abs(gp.radiusTop - 0.038) > 1e-4 || Math.abs(gp.height - 0.095) > 1e-4) return;
    const e = n.matrixWorld.elements;
    hit = { x: e[12], y: e[13], z: e[14] };
  });
  return hit;
});
if (!mug) { console.error('MISS: the mug body is not in this world'); process.exit(3); }
console.log(`mug at x ${mug.x.toFixed(3)} y ${mug.y.toFixed(3)} z ${mug.z.toFixed(3)}`);

// flat 301's spawn — the storey matters, or the hysteresis drops you to the lobby
const SPAWN = { x: 200 - 1.4, z: -20 + 3.7, gy: 2 * 2.7 };

const stations = [
  // the standing spot the module itself documents, and two paces a player
  // takes towards the window on the way to looking out of it
  ['spawn', SPAWN.x, SPAWN.z],
  ['mid', mug.x + 1.05, mug.z + 0.30],
  ['atsill', mug.x + 0.62, mug.z + 0.16],
];

for (const [tag, sx, sz] of stations) {
  // forward is (sin yaw, 0, -cos yaw) — crosstown.ts's rig convention
  const dx = mug.x - sx, dz = mug.z - sz;
  const yaw = Math.atan2(dx, -dz);
  const horiz = Math.hypot(dx, dz);

  // SOLVE the pitch sign rather than assume it: try both, keep whichever puts
  // the mug nearest the centre of the frame when projected through the camera.
  const best = await p.evaluate(async ([x, z, gy, yw, hz, mugp]) => {
    const cam = window.__ct.camera();
    let out = null;
    for (const sign of [1, -1]) {
      // pass 1: level, to read the true eye height off the camera rather than
      // retyping the 7.02 the module's comment mentions
      window.__ct.warp(x, z, yw, gy, 0);
      await new Promise((r) => requestAnimationFrame(() => r()));
      const eyeY = cam.position.y;
      const want = sign * Math.atan2(eyeY - mugp.y, hz);
      window.__ct.warp(x, z, yw, gy, want);
      await new Promise((r) => requestAnimationFrame(() => r()));
      cam.updateMatrixWorld(true);
      const v = new cam.position.constructor(mugp.x, mugp.y, mugp.z).project(cam);
      const off = Math.hypot(v.x, v.y);
      if (!out || off < out.off) out = { sign, pitch: want, off, ndc: { x: v.x, y: v.y, z: v.z }, eyeY };
    }
    return out;
  }, [sx, sz, SPAWN.gy, yaw, horiz, mug]);

  await p.evaluate(([x, z, gy, yw, pi]) => window.__ct.warp(x, z, yw, gy, pi),
    [sx, sz, SPAWN.gy, yaw, best.pitch]);
  await p.waitForTimeout(600);

  const at = await p.evaluate(() => window.__ct.pos());
  if (Math.hypot(at[0] - sx, at[2] - sz) > 0.05) {
    console.log(`  *** the warp did not land: asked (${sx.toFixed(2)}, ${sz.toFixed(2)}), `
      + `stood (${at[0].toFixed(2)}, ${at[2].toFixed(2)}) ***`);
    process.exitCode = 5;
  }

  // aim.mjs rule 2: the camera must have LINE OF SIGHT. Projecting inside the
  // viewport only proves the mug is in the frustum — not that anything but a
  // wardrobe door is drawn there. Raycast camera → mug and name what is first.
  const los = await p.evaluate((mugp) => {
    const cam = window.__ct.camera(), s = window.__ct.scene();
    s.updateMatrixWorld(true); cam.updateMatrixWorld(true);
    const V = cam.position.constructor;
    const to = new V(mugp.x, mugp.y, mugp.z);
    const dir = to.clone().sub(cam.position);
    const dist = dir.length(); dir.normalize();
    // three's Raycaster is not on __ct, so intersect by hand against every
    // visible mesh's world AABB — coarse, but it cannot miss a wardrobe
    let nearest = null;
    s.traverse((n) => {
      if (!n.isMesh || !n.geometry) return;
      for (let q = n; q; q = q.parent) if (q.visible === false) return;
      const g = n.geometry; if (!g.boundingBox) g.computeBoundingBox();
      if (!g.boundingBox) return;
      const bb = g.boundingBox.clone().applyMatrix4(n.matrixWorld);
      // THE MUG'S OWN PARTS ARE NOT AN OBSTRUCTION. The first run of this
      // reported the sightline BLOCKED at every station by "a 0.02x0.07x0.07
      // TorusGeometry" — the handle, 55 mm out from the axis and therefore
      // nearer the player than the cup it belongs to. Excluding by distance
      // alone was not enough; exclude anything sitting inside the mug.
      const c = bb.getCenter(new V());
      if (c.distanceTo(to) < 0.15) return;
      // slab test
      let t0 = 0.02, t1 = dist - 0.05;
      for (const ax of ['x', 'y', 'z']) {
        const o = cam.position[ax], d = dir[ax];
        if (Math.abs(d) < 1e-9) { if (o < bb.min[ax] || o > bb.max[ax]) return; continue; }
        let a = (bb.min[ax] - o) / d, bq = (bb.max[ax] - o) / d;
        if (a > bq) { const t = a; a = bq; bq = t; }
        t0 = Math.max(t0, a); t1 = Math.min(t1, bq);
        if (t0 > t1) return;
      }
      const sz = (bb.max.x - bb.min.x) * (bb.max.y - bb.min.y) * (bb.max.z - bb.min.z);
      if (!nearest || t0 < nearest.t) nearest = { t: t0, type: n.geometry.type, vol: sz,
        w: +(bb.max.x - bb.min.x).toFixed(2), h: +(bb.max.y - bb.min.y).toFixed(2),
        d: +(bb.max.z - bb.min.z).toFixed(2) };
    });
    return { dist, nearest };
  }, mug);
  if (los.nearest) {
    console.log(`     *** BLOCKED at ${los.nearest.t.toFixed(2)} m of ${los.dist.toFixed(2)}: `
      + `a ${los.nearest.w}x${los.nearest.h}x${los.nearest.d} ${los.nearest.type} is in the way ***`);
  }

  const inFrame = Math.abs(best.ndc.x) <= 1 && Math.abs(best.ndc.y) <= 1 && best.ndc.z < 1
    && !los.nearest;
  // HOW BIG IS IT, IN PIXELS? This is the whole question the item asks — "the
  // world is unlit 8 px/m, at that scale a mug is about three texels wide, so
  // a handle modelled honestly will not read". Measure it rather than assume:
  // project the whole mug group's world AABB and report its screen extent.
  const px = await p.evaluate((mugp) => {
    const cam = window.__ct.camera(), s = window.__ct.scene();
    s.updateMatrixWorld(true); cam.updateMatrixWorld(true);
    const V = cam.position.constructor;
    let mn = null, mx = null;
    s.traverse((n) => {
      if (!n.isMesh || !n.geometry) return;
      const t = n.geometry.type, gp = n.geometry.parameters || {};
      const body = t === 'CylinderGeometry' && Math.abs(gp.radiusTop - 0.038) < 1e-4
        && Math.abs(gp.height - 0.095) < 1e-4;
      const handle = t === 'TorusGeometry' && Math.abs(gp.radius - 0.026) < 6e-3;
      if (!body && !handle) return;
      const g = n.geometry; g.computeBoundingBox();
      const bb = g.boundingBox.clone().applyMatrix4(n.matrixWorld);
      // ONLY THIS MUG. Without this the sweep matched same-sized geometry
      // elsewhere in the city — including behind the camera, where projection
      // diverges — and reported the mug as "864 x 1565 PIXELS". A screen-space
      // measurement that includes a point behind the eye is not a measurement.
      const c0 = bb.getCenter(new V());
      if (c0.distanceTo(new V(mugp.x, mugp.y, mugp.z)) > 0.25) return;
      for (const cx of [bb.min.x, bb.max.x]) for (const cy of [bb.min.y, bb.max.y])
        for (const cz of [bb.min.z, bb.max.z]) {
          const v = new V(cx, cy, cz).project(cam);
          const sx2 = (v.x * 0.5 + 0.5) * window.innerWidth;
          const sy2 = (-v.y * 0.5 + 0.5) * window.innerHeight;
          if (!mn) { mn = { x: sx2, y: sy2 }; mx = { x: sx2, y: sy2 }; }
          mn.x = Math.min(mn.x, sx2); mn.y = Math.min(mn.y, sy2);
          mx.x = Math.max(mx.x, sx2); mx.y = Math.max(mx.y, sy2);
        }
    });
    return mn ? { w: mx.x - mn.x, h: mx.y - mn.y } : null;
  }, mug);

  const file = `shots/w60-mug-${label}-${tag}.png`;
  await p.screenshot({ path: file });
  console.log(`  ${file}`);
  console.log(`     stood (${at[0].toFixed(2)}, ${at[2].toFixed(2)}) eye ${best.eyeY.toFixed(2)}`
    + `  range ${horiz.toFixed(2)} m  pitch ${best.pitch.toFixed(3)} (sign ${best.sign})`);
  if (px) console.log(`     the whole mug covers ${px.w.toFixed(1)} x ${px.h.toFixed(1)} PIXELS here`);
  console.log(`     mug projects to NDC (${best.ndc.x.toFixed(3)}, ${best.ndc.y.toFixed(3)})`
    + `  ${inFrame ? 'IN FRAME' : '*** MISS — subject not in this frame ***'}`);
  if (!inFrame) process.exitCode = 4;
}
await b.close();
