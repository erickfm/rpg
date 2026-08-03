// w100 / item 96 — NAME THE THING UNDER A PIXEL, don't guess at it.
//
// w97: "a large untrimmed red mass fills the right ~40% of the frame [of
// shots/bug-hotel-far.png] ... I did not identify what that mass is and I am
// not going to guess." This names it: warp to a station, raycast a grid of
// screen points back through the camera, and report the mesh each one hits with
// its world AABB and material.
//
// Usage: SHOT_URL=http://localhost:4562/ node scripts/probes/w100-hotel-pixel-raycast.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.SHOT_URL || 'http://localhost:4177/';
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct && window.__ct.roomDims, null, { timeout: 30000 });
await p.evaluate(() => window.__ct.clock(13, 0));   // fixed hour: a game day is 24 real minutes

const room = await p.evaluate(() => window.__ct.roomDims().find((r) => r.id === 'hotel'));
const CX = room.cx, CZ = room.cz;

// Stations, in ROOM-LOCAL coordinates, converted to world below.
// far  — north end, off the east wall, looking back down the length at the door
// wide — mid-room by the lift, looking across at the east wall
const STATIONS = [
  { id: 'far', lx: 3.6, lz: -10.0, yaw: Math.PI },
  { id: 'wide', lx: 0.0, lz: 2.0, yaw: 0 },
];

// The Raycaster class is not reachable from `__ct`, so the projection is done by
// hand — but from the CAMERA'S OWN matrices via `unproject`, which is three's
// inverse of the projection it just rendered with, so this cannot drift from
// what was drawn.
for (const s of STATIONS) {
  await p.evaluate(({ x, z, yaw }) => window.__ct.warp(x, z, yaw, 0, 0),
    { x: CX + s.lx, z: CZ + s.lz, yaw: s.yaw });
  await p.waitForTimeout(700);
  await p.screenshot({ path: `shots/w100-hotel-${s.id}.png` });

  const named = await p.evaluate(({ CX, CZ }) => {
    const scene = window.__ct.scene();
    const cam = window.__ct.camera();
    scene.updateMatrixWorld(true);
    cam.updateMatrixWorld(true);

    // collect candidate meshes with world AABBs, then do slab-test ray/AABB.
    // AABB rather than triangle-exact: every object in this room is an axis
    // aligned box or a wall plane, and an AABB hit names the object, which is
    // the whole question. Rotated meshes are flagged so a reader knows.
    const objs = [];
    scene.traverse((o) => {
      if (!o.isMesh || !o.geometry || !o.visible) return;
      let par = o; let vis = true;
      while (par) { if (!par.visible) vis = false; par = par.parent; }
      if (!vis) return;
      const g = o.geometry;
      if (!g.boundingBox) g.computeBoundingBox();
      if (!g.boundingBox) return;
      const bb = g.boundingBox;
      let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < 8; i++) {
        const v = o.position.clone().set(
          (i & 1) ? bb.max.x : bb.min.x,
          (i & 2) ? bb.max.y : bb.min.y,
          (i & 4) ? bb.max.z : bb.min.z).applyMatrix4(o.matrixWorld);
        mn = [Math.min(mn[0], v.x), Math.min(mn[1], v.y), Math.min(mn[2], v.z)];
        mx = [Math.max(mx[0], v.x), Math.max(mx[1], v.y), Math.max(mx[2], v.z)];
      }
      // only things near this room — 40 m box, so the corridor east of it counts
      const cx = (mn[0] + mx[0]) / 2, cz = (mn[2] + mx[2]) / 2;
      if (Math.abs(cx - CX) > 20 || Math.abs(cz - CZ) > 30) return;
      const mat = Array.isArray(o.material) ? o.material[0] : o.material;
      objs.push({ mn, mx, type: g.type,
        col: mat && mat.color ? '#' + mat.color.getHexString() : '',
        map: !!(mat && mat.map),
        rot: +(Math.abs(o.rotation.x) + Math.abs(o.rotation.y) + Math.abs(o.rotation.z)).toFixed(3) });
    });

    const origin = cam.getWorldPosition(cam.position.clone());
    const shoot = (ndcx, ndcy) => {
      const tgt = cam.position.clone().set(ndcx, ndcy, 0.5).unproject(cam);
      const d = tgt.sub(origin).normalize();
      let best = null, bestT = Infinity;
      for (const o of objs) {
        let t0 = -Infinity, t1 = Infinity, ok = true;
        for (let a = 0; a < 3; a++) {
          const oa = a === 0 ? origin.x : a === 1 ? origin.y : origin.z;
          const da = a === 0 ? d.x : a === 1 ? d.y : d.z;
          if (Math.abs(da) < 1e-9) { if (oa < o.mn[a] || oa > o.mx[a]) { ok = false; break; } continue; }
          let ta = (o.mn[a] - oa) / da, tb = (o.mx[a] - oa) / da;
          if (ta > tb) { const s = ta; ta = tb; tb = s; }
          t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
          if (t0 > t1) { ok = false; break; }
        }
        if (!ok || t1 < 0.05) continue;
        const t = t0 > 0.05 ? t0 : t1;
        if (t < bestT) { bestT = t; best = o; }
      }
      return best ? {
        t: +bestT.toFixed(2), type: best.type, col: best.col, map: best.map, rot: best.rot,
        size: [+(best.mx[0] - best.mn[0]).toFixed(2), +(best.mx[1] - best.mn[1]).toFixed(2), +(best.mx[2] - best.mn[2]).toFixed(2)],
        c: [+((best.mn[0] + best.mx[0]) / 2).toFixed(2), +((best.mn[1] + best.mx[1]) / 2).toFixed(2), +((best.mn[2] + best.mx[2]) / 2).toFixed(2)],
      } : null;
    };

    const rows = [];
    for (const [lab, nx, ny] of [
      ['right-40% upper', 0.75, 0.45], ['right-40% mid', 0.70, 0.0], ['right-40% low', 0.65, -0.45],
      ['far right edge', 0.95, 0.0], ['centre', 0.0, 0.0], ['ceiling centre', 0.0, 0.80],
      ['ceiling left', -0.6, 0.75], ['left wall', -0.75, 0.0], ['floor centre', 0.0, -0.6],
    ]) rows.push({ lab, nx, ny, hit: shoot(nx, ny) });
    return { n: objs.length, rows, eye: [+origin.x.toFixed(2), +origin.y.toFixed(2), +origin.z.toFixed(2)] };
  }, { CX, CZ });

  console.log(`\n=== station ${s.id}  eye ${named.eye.join(', ')}  (${named.n} candidate meshes) ===`);
  for (const r of named.rows) {
    const h = r.hit;
    console.log(`  ${r.lab.padEnd(16)} ndc(${String(r.nx).padStart(5)},${String(r.ny).padStart(5)})  `
      + (h ? `t=${String(h.t).padStart(6)}m  ${h.type.replace('Geometry', '').padEnd(6)} `
        + `${h.size.join('×').padEnd(20)} @ ${h.c.join(',').padEnd(22)} ${(h.col || '-').padEnd(8)} map=${h.map ? 'Y' : '.'} rot=${h.rot}`
        : 'NOTHING'));
  }
}

await b.close();
