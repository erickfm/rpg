// Item 93, defect 1 — *"when folks sit, they clip"*. A LOOKING tool.
// Both rooms' source comments claim this was already fixed ("NO Y FUDGE
// ANYWHERE", "citizenPlane owns the 0.445 m hip offset"), and a comment is not
// a frame. Stand in front of each sitter and photograph them.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4450/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 620 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.spots, null, { timeout: 30000 });
await p.evaluate(() => window.__ct.clock(12, 30));
// THE FIRST RUN CAME BACK ALL BLACK and there was nothing wrong with the world:
// the region cull hides an interior you are not registered as being inside, and
// a warp does not enter a room. `cullRegions(false)` is the affordance for
// exactly this (crosstown.ts) — an A/B that has to compare two BUILDS is
// comparing two worlds; this compares two frames of one.
await p.evaluate(() => window.__ct.cullRegions(false));

// Find every seated figure the kit tagged, and its world position. This is the
// tag `room.person`/`sitter` stamp, so it finds them without a coordinate here.
const sitters = await p.evaluate(() => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (o.userData?.citizen && o.userData?.seated) {
      o.updateWorldMatrix(true, false);
      out.push({ x: +o.position.x.toFixed(2), y: +o.position.y.toFixed(2), z: +o.position.z.toFixed(2) });
    }
  });
  return out;
});
console.log(`seated figures tagged in the world: ${sitters.length}`);
for (const s of sitters) console.log(`   (${s.x}, ${s.y}, ${s.z})`);

let n = 0;
for (const s of sitters) {
  // stand 2.2 m away on each of two headings and look at the hip
  for (const [dx, dz, tag] of [[0, 2.2, 'front'], [2.2, 0, 'side']]) {
    const px = s.x + dx, pz = s.z + dz;
    const gy = await p.evaluate(([a, c]) => window.__ct.groundAt(a, c), [px, pz]);
    // yaw so forward points at the figure: fwd = (sin yaw, -cos yaw)
    const yaw = Math.atan2(s.x - px, -(s.z - pz));
    await p.evaluate(([a, c, y, g]) => window.__ct.warp(a, c, y, g, 0), [px, pz, yaw, gy]);
    for (let i = 0; i < 8; i++) await p.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
    await p.screenshot({ path: `shots/w89-sitter-${n}-${tag}.png` });
  }
  n++;
}
console.log(`wrote ${n * 2} shots to shots/w89-sitter-*.png`);
await b.close();
