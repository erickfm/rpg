// ITEM 272 — IS THE MISSING LEG A MISSING PAINTING, OR A HIDDEN ONE?
//
// The desk offered three candidates and asserted none. This settles it by
// removing one variable at a time from the RUNNING world, so the answer does
// not depend on reading the drawing code correctly:
//
//   asis      the booth as it ships
//   nobench   the two bench boxes the sitters are on made invisible
//   lifted    the sitters raised 1.2 m, clear of every solid in the room
//
// If `nobench` shows legs, the paint exists and the bench is eating it —
// candidate (2), OCCLUSION. If `lifted` shows legs but `nobench` does not, the
// occluder is something else. If NEITHER shows legs, the flag is not set or the
// art is not drawn — candidate (1).
//
// NEGATIVE CASE, and it is the point of the third shot: `lifted` is a state the
// game never renders, so it can only tell you about the ATLAS. Both are needed.
import { chromium } from 'playwright';
import { waitPainted } from '../lib/painted.mjs';
import { mkdirSync } from 'node:fs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('ABORTED: set SHOT_URL — exit 3.'); process.exit(3); }
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct && window.__ct.roomDims, null, { timeout: 60000 });
await waitPainted(p, { quiet: true });
const room = await p.evaluate(() => window.__ct.roomDims().find((r) => /diner/i.test(r.id)));
await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [room.cx, room.cz]);
await waitPainted(p, { quiet: true });

const info = await p.evaluate(([cx, cz, w, d]) => {
  const inR = (x, z) => x >= cx - w / 2 && x <= cx + w / 2 && z >= cz - d / 2 && z <= cz + d / 2;
  const sitters = [];
  window.__ct.scene().traverse((o) => {
    if (!o.userData?.citizen || !o.userData?.seated) return;
    o.updateWorldMatrix(true, false);
    const q = o.getWorldPosition(new o.position.constructor());
    if (inR(q.x, q.z)) { sitters.push(o); }
  });
  window.__W112 = { sitters, benches: [] };
  // the bench each sitter is on: a solid whose top face is at the sitter's own
  // origin height (the seat top IS the hip origin — citizenPlane owns that)
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || o.userData?.citizen || !o.geometry) return;
    o.updateWorldMatrix(true, false);
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    for (const s of sitters) {
      if (Math.abs(bb.max.y - s.position.y) < 0.02 && bb.min.y < 0.05
        && bb.max.x > s.position.x - 0.05 && bb.min.x < s.position.x + 0.05
        && bb.max.z > s.position.z - 0.05 && bb.min.z < s.position.z + 0.05) {
        window.__W112.benches.push(o);
      }
    }
  });
  return {
    sitters: sitters.map((s) => ({ x: s.position.x, y: s.position.y, z: s.position.z })),
    benches: window.__W112.benches.length,
  };
}, [room.cx, room.cz, room.w, room.d]);

console.log(`sitters ${info.sitters.length}   benches under them ${info.benches}`);
if (info.sitters.length < 2 || info.benches < 2) {
  console.log('EXIT 3 — floor is 2 sitters each on an identified bench; measuring nothing.');
  await b.close(); process.exit(3);
}
const bx = info.sitters.reduce((s, q) => s + q.x, 0) / info.sitters.length;
const bz = info.sitters[0].z;
const dir = Math.sign(room.cz - bz) || -1;
const sx = bx, sz = bz + dir * 1.6;
const yaw = Math.atan2(bx - sx, -(bz - sz));   // rig yaw: 0 looks down −z (GOTCHAS 62)

const shoot = async (name) => {
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, -0.10), [sx, sz, yaw]);
  await waitPainted(p, { quiet: true });
  await p.screenshot({ path: `shots/w112-occl-${name}.png` });
  console.log(`shots/w112-occl-${name}.png`);
};

await shoot('asis');
await p.evaluate(() => { for (const m of window.__W112.benches) m.visible = false; });
await shoot('nobench');
await p.evaluate(() => {
  for (const m of window.__W112.benches) m.visible = true;
  for (const s of window.__W112.sitters) s.position.y += 1.2;
});
await shoot('lifted');
await b.close();
