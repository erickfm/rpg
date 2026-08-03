// ITEM 272 — WHY CAN THE USER NOT SEE A SEATED PERSON'S LEGS?
//
//   *"people sitting still looks bad because they have no legs??"*
//
// This is the MEASUREMENT half. It does not judge the art; it asks where each
// seated sprite's painted legs END UP IN THE WORLD, and what solid geometry
// stands between them and a player in the aisle.
//
// ⚠ WARP FIRST (GOTCHAS 79b). The player spawns in apartment 301 at x = 198,
// past the region cull, so a census from spawn sees no interior at all.
//
// POPULATION FLOOR: the world places seated citizens in the diner (2), the
// casino, the library and the church. If fewer than 2 seated sprites are found
// this exits 3 rather than reporting a cheerful zero.
import { chromium } from 'playwright';
import { waitPainted } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('ABORTED: set SHOT_URL — exit 3, nothing measured.'); process.exit(3); }

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct && window.__ct.roomDims, null, { timeout: 60000 });
await waitPainted(p, { quiet: true });

const room = await p.evaluate(() => window.__ct.roomDims().find((r) => /diner/i.test(r.id)));
if (!room) { console.log('EXIT 3 — no diner in roomDims()'); await b.close(); process.exit(3); }
console.log(`diner  cx ${room.cx.toFixed(2)}  cz ${room.cz.toFixed(2)}  w ${room.w}  d ${room.d}`);

// stand in the middle of the room so the interior is live and unculled
await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [room.cx, room.cz]);
await waitPainted(p, { quiet: true });

const data = await p.evaluate(([cx, cz, w, d]) => {
  const THREE = window.__ct.scene().children[0]?.constructor;   // unused; kept explicit below
  const out = { people: [], errs: [] };
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
  const inRoom = (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1;

  const scene = window.__ct.scene();
  const people = [];
  scene.traverse((o) => {
    if (!o.userData || !o.userData.citizen) return;
    people.push(o);
  });

  // every mesh in the room that is NOT a citizen, with its world AABB — this is
  // what can stand between the camera and a pair of legs
  const solids = [];
  scene.traverse((o) => {
    if (!o.isMesh || o.userData?.citizen) return;
    if (!o.geometry) return;
    o.updateWorldMatrix(true, false);
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox.clone();
    bb.applyMatrix4(o.matrixWorld);
    const c = { x: (bb.min.x + bb.max.x) / 2, z: (bb.min.z + bb.max.z) / 2 };
    if (!inRoom(c.x, c.z)) return;
    solids.push({ minX: bb.min.x, maxX: bb.max.x, minY: bb.min.y, maxY: bb.max.y,
                  minZ: bb.min.z, maxZ: bb.max.z });
  });

  for (const o of people) {
    o.updateWorldMatrix(true, false);
    const pos = o.getWorldPosition(new o.position.constructor());
    if (!inRoom(pos.x, pos.z)) continue;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const g = o.geometry.boundingBox;
    const sy = o.scale.y, sx = o.scale.x;
    // the plane's own local extents, scaled — the origin is the HIP when seated
    const rec = {
      seated: !!o.userData.seated,
      x: pos.x, y: pos.y, z: pos.z,
      localMinY: g.min.y, localMaxY: g.max.y,
      worldMinY: pos.y + g.min.y * sy, worldMaxY: pos.y + g.max.y * sy,
      scaleY: sy, scaleX: sx,
      // the painted shoe sits 4 rows above the frame bottom; the hip is the
      // origin when seated. Both are derived from the geometry, not typed.
    };
    // WHAT SITS IN FRONT OF THE LEGS? The legs occupy y from worldMinY up to
    // the origin (the hip). Anything overlapping that y band, within a metre
    // in x and z, is a candidate occluder.
    rec.near = solids.filter((s) =>
      s.maxY > rec.worldMinY + 0.02 && s.minY < pos.y - 0.02
      && s.maxX > pos.x - 0.9 && s.minX < pos.x + 0.9
      && s.maxZ > pos.z - 0.9 && s.minZ < pos.z + 0.9)
      .map((s) => ({
        dx0: +(s.minX - pos.x).toFixed(3), dx1: +(s.maxX - pos.x).toFixed(3),
        dz0: +(s.minZ - pos.z).toFixed(3), dz1: +(s.maxZ - pos.z).toFixed(3),
        y0: +s.minY.toFixed(3), y1: +s.maxY.toFixed(3),
      }));
    out.people.push(rec);
  }
  out.solidCount = solids.length;
  return out;
}, [room.cx, room.cz, room.w, room.d]);

const seated = data.people.filter((q) => q.seated);
console.log(`citizens inside the diner: ${data.people.length}  (seated: ${seated.length})  room solids: ${data.solidCount}`);
if (seated.length < 2) {
  console.log('EXIT 3 — population floor is 2 seated diner customers; measuring nothing.');
  await b.close(); process.exit(3);
}

for (const q of seated) {
  const hip = q.y;
  console.log(`\nseated sprite at (${q.x.toFixed(2)}, ${q.y.toFixed(3)}, ${q.z.toFixed(2)})  scaleY ${q.scaleY}`);
  console.log(`  painted extent y ${q.worldMinY.toFixed(3)} .. ${q.worldMaxY.toFixed(3)}   hip(origin) ${hip.toFixed(3)}`);
  console.log(`  LEG BAND is y ${q.worldMinY.toFixed(3)} .. ${hip.toFixed(3)}  (${(hip - q.worldMinY).toFixed(3)} m of sprite)`);
  console.log(`  solids overlapping that band within 0.9 m, offsets from the sprite:`);
  for (const s of q.near) {
    console.log(`     x ${String(s.dx0).padStart(7)}..${String(s.dx1).padStart(7)}   `
      + `z ${String(s.dz0).padStart(7)}..${String(s.dz1).padStart(7)}   y ${s.y0}..${s.y1}`);
  }
  if (!q.near.length) console.log('     (none)');
}
await b.close();
