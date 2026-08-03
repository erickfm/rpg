// ITEM 272 — IS IT THE ART OR IS IT THE FURNITURE? One camera, two frames.
//
// The row lists three candidates and asks which one it is. This decides between
// them by EXPERIMENT rather than by reading geometry:
//
//   A  the booth as it stands
//   B  the identical camera, with every bench, backrest and table in the room
//      made invisible — nothing else touched, the sitter untouched
//
// If B shows legs, they are drawn and something is in front of them: candidate
// (2), occlusion, and the fix is the furniture or the pose, not the atlas.
// If B shows no legs either, the sprite is not drawing them: candidate (1).
// And B also measures the SPRITE'S OWN EXTENT, which decides (3): a sitter
// whose shoe is at y ≈ 0 is not floating however it looks.
//
// Hiding is done by flipping `visible` on the furniture ONLY for the shot and
// putting it straight back. That is a legitimate use of `visible` — this IS a
// rendering question (contrast GOTCHAS 79, where `visible` was being used to
// answer an AUTHORING question and measured nothing).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { waitPainted } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
const TAG = (process.argv.find((a) => a.startsWith('--tag=')) ?? '--tag=x').slice(6);
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.evaluate(() => window.__ct.clock(13, 0));

const room = (await p.evaluate(() => window.__ct.roomDims())).find((r) => r.id === 'diner');
await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [room.cx, room.cz]);
await waitPainted(p, { quiet: true });

// find the sitters and the furniture, and publish the sprite's TRUE world span
// (its geometry is translated so the origin is the hip — reading position ± h/2
// gives the wrong answer, which is what my first pass at this did)
const found = await p.evaluate(([cx, cz, hw, hd]) => {
  const near = (o) => Math.abs(o.x - cx) <= hw && Math.abs(o.z - cz) <= hd;
  const sitters = [], furn = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    o.updateWorldMatrix(true, false);
    const e = o.matrixWorld.elements, at = { x: e[12], y: e[13], z: e[14] };
    if (!near(at)) return;
    const g = o.geometry;
    if (g.type === 'PlaneGeometry' && o.userData?.citizenFacing !== undefined) {
      g.computeBoundingBox();
      const bb = g.boundingBox;
      sitters.push({ x: at.x, y: at.y, z: at.z,
        loY: at.y + bb.min.y * (o.scale?.y ?? 1), hiY: at.y + bb.max.y * (o.scale?.y ?? 1) });
      return;
    }
    if (g.type === 'BoxGeometry' && g.parameters) {
      const { width, height, depth } = g.parameters;
      const bench = height > 0.3 && height < 0.6 && depth > 1.0 && width > 0.35 && width < 0.8;
      const back = height > 0.5 && height < 0.8 && depth > 1.0 && width < 0.2;
      const table = height < 0.12 && width > 0.6 && depth > 0.9;
      if (bench || back || table) furn.push(o.uuid);
    }
  });
  window.__w272 = furn;
  return { sitters, nFurn: furn.length };
}, [room.cx, room.cz, room.w / 2, room.d / 2]);

if (!found.sitters.length) { console.error('no citizen sprites in the diner'); await b.close(); process.exit(3); }
console.log(`\n  ${found.sitters.length} citizen sprite(s), ${found.nFurn} bench/backrest/table box(es)`);
for (const s of found.sitters) {
  console.log(`    sitter at (${s.x.toFixed(2)}, ${s.z.toFixed(2)})  sprite spans y `
    + `${s.loY.toFixed(3)} … ${s.hiY.toFixed(3)}`
    // The SPRITE'S BOTTOM EDGE IS NOT THE SHOE. `citizenPlane` leaves 4 empty
    // rows under the painted shoe (that gap WAS the old 12 cm float), so the
    // plane legitimately dips below the floor and a "bottom edge at 0" test
    // would fail a correct figure. The shoe is row 59 of 64 over H = 1.9:
    // it sits (64 − 59)/64 × 1.9 = 0.148 m above the bottom edge.
    + `   shoe at y ${(s.loY + (5 / 64) * 1.9).toFixed(3)}`);
}

// the camera: at the aisle end of the sitter's booth, eye height, looking at them
const s = found.sitters[0];
const CAM = { x: s.x, z: s.z - 2.2 };
// fwd = (sin yaw, 0, −cos yaw), so to look along (dx, dz) the yaw is
// atan2(dx, −dz). Writing atan2(dx, dz) faces you the OPPOSITE way and the two
// frames come back byte-identical because both photograph the same blank wall —
// which is exactly what the first run of this file did.
const yaw = Math.atan2(s.x - CAM.x, -(s.z - CAM.z));
const setFurn = (on) => p.evaluate((v) => {
  const want = new Set(window.__w272);
  window.__ct.scene().traverse((o) => { if (want.has(o.uuid)) o.visible = v; });
}, on);

const shoot = async (name) => {
  await p.evaluate(([a, c, y]) => window.__ct.warp(a, c, y, 0, -0.13), [CAM.x, CAM.z, yaw]);
  await waitPainted(p, { quiet: true }).catch(() => {});
  await p.waitForTimeout(500);
  const buf = await p.screenshot({ path: `shots/w108-272-${TAG}-${name}.png` });
  console.log(`  shots/w108-272-${TAG}-${name}.png  ${buf.length} bytes`);
};

await setFurn(true);
await shoot('A-as-built');
await setFurn(false);
await shoot('B-furniture-hidden');
await setFurn(true);              // put the room back
console.log(`\n  camera (${CAM.x.toFixed(2)}, ${CAM.z.toFixed(2)}) yaw ${yaw.toFixed(2)}`
  + `  looking at the sitter at (${s.x.toFixed(2)}, ${s.z.toFixed(2)})`);
await b.close();
