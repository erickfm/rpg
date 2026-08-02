// Locate the 12 flat, unmapped car-lot bay slabs by live scene scan (same
// predicate the audit used), and print enough about each mesh — name,
// userData, geometry params, world AABB, material — to find the construction
// site in source.
//
//   SHOT_URL=http://localhost:4190/ node scripts/find-lot-slabs.mjs
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('aim it: SHOT_URL=http://localhost:PORT/'); process.exit(2); }
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await reportWorld(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const out = await p.evaluate(() => {
  const scene = window.__ct.scene();
  const THREE = window.THREE || null;
  const results = [];
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const geo = o.geometry;
    if (!geo.boundingBox) geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const size = { x: bb.max.x - bb.min.x, y: bb.max.y - bb.min.y, z: bb.max.z - bb.min.z };
    // world position of the box centre, from the matrix directly
    const e = o.matrixWorld.elements;
    const worldX = e[12], worldY = e[13], worldZ = e[14];
    // horizontal-ish: one dimension much smaller than the other two
    const dims = [size.x, size.y, size.z].sort((a, c) => a - c);
    const isHorizontal = dims[0] < 0.05 * Math.max(dims[1], dims[2]) || dims[0] < 0.05;
    const area = dims[1] * dims[2];
    if (!(worldY > -0.35 && worldY < 0.55)) return;
    if (area < 1.0) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const hasMap = mats.some((m) => m && m.map);
    if (hasMap) return;
    // rough world position (mesh position, not full matrix decompose to keep it simple)
    const pos = o.position;
    results.push({
      name: o.name || '(no name)',
      userData: JSON.stringify(o.userData || {}),
      geoType: geo.type,
      size,
      area: +area.toFixed(2),
      worldPos: [+worldX.toFixed(2), +worldY.toFixed(3), +worldZ.toFixed(2)],
      localPos: [+pos.x.toFixed(2), +pos.y.toFixed(2), +pos.z.toFixed(2)],
      matColor: mats[0] && mats[0].color ? mats[0].color.getHexString() : null,
    });
  });
  return results;
});

console.log(`found ${out.length} candidate flat unmapped horizontal meshes >= 1 m2, y in [-0.35, 0.55]`);
for (const r of out) {
  console.log(JSON.stringify(r));
}
await b.close();
