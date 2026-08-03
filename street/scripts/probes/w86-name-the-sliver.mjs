// NAME THE TWO FLAT SLIVERS ON 301's FLOOR. Item 169.
//
// `w86-everything-on-the-boards.mjs` found exactly two meshes matching the
// user's description — horizontal PlaneGeometry 0.28 x 1.07 m lying 2 mm above
// the boards, at (199.97, 0.002, -16.5) and (202.43, 0.002, -16.5), one against
// each side wall. This dumps everything identifying about them (name, parents,
// userData, texture) and then stands next to one and photographs it.
//
//   SHOT_URL=http://localhost:4420/ node scripts/probes/w86-name-the-sliver.mjs
import { chromium } from 'playwright';
import { installMats } from '../lib/materials.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL || 'http://localhost:4420/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 750 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await installMats(p);
await p.waitForTimeout(600);

const info = await p.evaluate(() => {
  const S = window.__ct.scene(); S.updateMatrixWorld(true);
  const targets = [[199.97, -16.5], [202.43, -16.5]];
  const out = [];
  S.traverse((o) => {
    if (!o.isMesh) return;
    const e = o.matrixWorld.elements, x = e[12], y = e[13], z = e[14];
    if (y < -0.2 || y > 0.4) return;
    if (!targets.some(([tx, tz]) => Math.hypot(x - tx, z - tz) < 0.3)) return;
    const chain = []; let q = o;
    while (q && chain.length < 8) { chain.push(`${q.name || q.type}${q.userData?.mod ? `(mod=${q.userData.mod})` : ''}`); q = q.parent; }
    const m = window.__mats(o)[0];
    // read a few texels straight off the texture's own canvas, which is what
    // actually decides what the player sees
    let texel = null, texSize = null;
    const img = m?.map?.image;
    if (img && img.getContext) {
      texSize = [img.width, img.height];
      const g = img.getContext('2d');
      const d = g.getImageData(0, 0, img.width, img.height).data;
      const px = [];
      for (let i = 0; i < d.length && px.length < 6; i += 4 * Math.max(1, Math.floor(d.length / 4 / 6)))
        px.push(`rgba(${d[i]},${d[i + 1]},${d[i + 2]},${d[i + 3]})`);
      texel = px;
    }
    out.push({
      at: [+x.toFixed(3), +y.toFixed(4), +z.toFixed(3)],
      name: o.name, geo: o.geometry?.type,
      par: o.geometry?.parameters,
      rot: [+o.rotation.x.toFixed(3), +o.rotation.y.toFixed(3), +o.rotation.z.toFixed(3)],
      scale: [o.scale.x, o.scale.y, o.scale.z],
      userData: o.userData,
      chain,
      mat: { type: m?.type, col: m?.color ? '#' + m.color.getHexString() : null, mapName: m?.map?.name, texSize, texel, side: m?.side, transparent: m?.transparent, opacity: m?.opacity, depthWrite: m?.depthWrite, blending: m?.blending },
      renderOrder: o.renderOrder,
    });
  });
  return out;
});
console.log(JSON.stringify(info, null, 2));

// STAND NEXT TO IT AND LOOK. Two framings: from the room centre looking at the
// west sliver, and from directly above it.
await p.evaluate(() => window.__ct.clock(12, 0));
await p.waitForTimeout(700);
const shots = [
  ['west-from-room', 201.2, -15.6, Math.atan2(199.97 - 201.2, -(-16.5 + 15.6)), -0.75],
  ['west-overhead', 199.97, -16.2, 0, -1.45],
  ['east-from-room', 201.2, -15.6, Math.atan2(202.43 - 201.2, -(-16.5 + 15.6)), -0.75],
];
for (const [tag, x, z, yaw, pitch] of shots) {
  await p.evaluate(([x, z, y, pi]) => window.__ct.warp(x, z, y, undefined, pi), [x, z, yaw, pitch]);
  await waitPainted(p, { quiet: true });
  await p.screenshot({ path: `shots/w86-sliver-${tag}.png` });
  console.log(`  shot -> shots/w86-sliver-${tag}.png`);
}
await b.close();
