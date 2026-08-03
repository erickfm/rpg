// Item 265, step 3 — NAME the thing at x 5.07…5.73, z −35.92…−34.08.
//
// Step 2 found exactly one static collider on the line, 0.661 × 1.84 m, with no
// tag. A collider without a tag cannot say what it is, so this walks the scene
// graph and reports every mesh whose world bounding box overlaps that footprint
// — name, position, size, and the material colour — which is enough to find the
// authoring site by grep.
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
const BOX = { minX: 5.07, maxX: 5.731, minZ: -35.92, maxZ: -34.08 };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForFunction(() => (window.__ct.painted?.()?.triangles ?? 0) > 0, { timeout: 20000 });
await p.evaluate(() => window.__ct.warp(6, -40, Math.PI, 0, 0));
await p.waitForTimeout(400);

const hits = await p.evaluate((B) => {
  const THREE_Box3 = window.__ct.scene().constructor;   // not used; kept explicit below
  void THREE_Box3;
  const out = [];
  const scene = window.__ct.scene();
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    // AUTHORING FACT, NOT A RENDERING ONE (GOTCHAS 79): `visible` is deliberately
    // NOT filtered on. The player spawns 98 m past the region-cull boundary, so
    // half this scene is `visible === false` at the moment this runs, and a
    // census that filtered would find nothing and say so in green.
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox.clone();
    o.updateWorldMatrix(true, false);
    bb.applyMatrix4(o.matrixWorld);
    if (bb.max.x < B.minX || bb.min.x > B.maxX) return;
    if (bb.max.z < B.minZ || bb.min.z > B.maxZ) return;
    const path = [];
    for (let q = o; q; q = q.parent) if (q.name) path.unshift(q.name);
    out.push({
      name: o.name || '(unnamed)',
      path: path.join(' / ') || '(no named ancestor)',
      pos: [+o.position.x.toFixed(2), +o.position.y.toFixed(2), +o.position.z.toFixed(2)],
      box: [+bb.min.x.toFixed(2), +bb.max.x.toFixed(2), +bb.min.y.toFixed(2),
            +bb.max.y.toFixed(2), +bb.min.z.toFixed(2), +bb.max.z.toFixed(2)],
      geom: o.geometry.type,
      params: o.geometry.parameters
        ? Object.entries(o.geometry.parameters)
            .filter(([, v]) => typeof v === 'number')
            .map(([k, v]) => `${k}=${+v.toFixed(3)}`).join(' ')
        : '',
      colour: o.material && o.material.color ? '#' + o.material.color.getHexString() : '',
      rotY: +o.rotation.y.toFixed(3),
      userData: Object.keys(o.userData ?? {}).join(','),
    });
  });
  return out;
}, BOX);

console.log(`\n${hits.length} mesh(es) overlap the blocking footprint`
  + ` x ${BOX.minX}…${BOX.maxX}, z ${BOX.minZ}…${BOX.maxZ}\n`);
for (const h of hits) {
  console.log(`  ${h.name}   [${h.path}]`);
  console.log(`      ${h.geom}  ${h.params}`);
  console.log(`      world box  x ${h.box[0]}…${h.box[1]}   y ${h.box[2]}…${h.box[3]}   z ${h.box[4]}…${h.box[5]}`);
  console.log(`      pos ${JSON.stringify(h.pos)}  rotY ${h.rotY}  colour ${h.colour}  userData [${h.userData}]`);
}
if (!hits.length) console.log('  (nothing — the collider has no mesh, which is itself the finding)');
await b.close();
