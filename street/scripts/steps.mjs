// FIND the library steps and the church steps by scanning ground height, and
// answer "is the park lit / alive" from the scene graph. Every warp is verified
// to have landed before its reading is used.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);
const out = await p.evaluate(async () => {
  const at = async (x, z) => {
    window.__ct.warp(x, z, 0, 0.14, 0);
    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => requestAnimationFrame(r));
    const q = window.__ct.pos();
    if (Math.abs(q[0] - x) > 0.05 || Math.abs(q[2] - z) > 0.05) return null;  // did not land
    return +q[3].toFixed(2);
  };
  const scan = async (x0, x1, z0, z1, step) => {
    const hits = []; let landed = 0, rejected = 0;
    for (let x = x0; x <= x1; x += step)
      for (let z = z0; z >= z1; z -= step) {
        const gy = await at(x, z);
        if (gy === null) { rejected++; continue; }
        landed++;
        if (gy > 0.20) hits.push([+x.toFixed(1), +z.toFixed(1), gy]);
      }
    return { hits, landed, rejected };
  };
  const lib = await scan(-22, -5, 2, -30, 0.5);      // library frontage + courtyard
  const church = await scan(-8, 14, -104, -114, 0.5); // church + churchyard
  // park: lights and life
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const P = { x0: -21, x1: -7, z0: -96, z1: -60 };
  let meshes = 0, glows = 0, tall = 0, bright = 0;
  s.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    for (let q = o; q; q = q.parent) if (q.visible === false) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); if (!g.boundingBox) return;
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const c = [(bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2, (bb.min.z + bb.max.z) / 2];
    if (c[0] < P.x0 || c[0] > P.x1 || c[2] < P.z0 || c[2] > P.z1) return;
    meshes++;
    if (bb.max.y - bb.min.y > 2.5) tall++;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (m && m.blending === 2) glows++;
    if (m && m.color && bb.min.y > 1.5 && m.color.getHex() > 0xc8b060) bright++;
  });
  const life = [];
  for (let i = 0; i < 6; i++) {
    let inPark = 0, total = 0;
    s.traverse(o => {
      if (!o.isMesh || !o.material || !o.material.map || !o.material.map.image) return;
      if (o.material.map.image.width !== 320) return;
      total++;
      if (o.position.x > P.x0 && o.position.x < P.x1 && o.position.z > P.z0 && o.position.z < P.z1) inPark++;
    });
    life.push({ total, inPark });
    await new Promise(r => setTimeout(r, 900));
  }
  return { lib, church, park: { meshes, tall, glows, bright }, life };
});
const cluster = (hits) => {
  const cs = [];
  for (const [x, z, gy] of hits) {
    const c = cs.find(k => Math.abs(k.cx - x) < 3 && Math.abs(k.cz - z) < 3);
    if (c) { c.n++; c.x0 = Math.min(c.x0, x); c.x1 = Math.max(c.x1, x);
      c.z0 = Math.min(c.z0, z); c.z1 = Math.max(c.z1, z);
      c.lo = Math.min(c.lo, gy); c.hi = Math.max(c.hi, gy); c.cx = (c.x0 + c.x1) / 2; c.cz = (c.z0 + c.z1) / 2; }
    else cs.push({ cx: x, cz: z, n: 1, x0: x, x1: x, z0: z, z1: z, lo: gy, hi: gy });
  }
  return cs.filter(c => c.n >= 2);
};
writeFileSync('shots/steps.json', JSON.stringify(out, null, 2));
for (const [name, r] of [['LIBRARY frontage/courtyard', out.lib], ['CHURCH frontage/yard', out.church]]) {
  console.log(`\n${name}: ${r.landed} points landed, ${r.rejected} warps rejected, ${r.hits.length} raised`);
  const cs = cluster(r.hits);
  if (!cs.length) console.log('   NO raised walkable ground found — nothing above 0.20 m');
  for (const c of cs.sort((a, b2) => b2.n - a.n))
    console.log(`   x ${c.x0} … ${c.x1}   z ${c.z0} … ${c.z1}   gy ${c.lo} … ${c.hi}   (${c.n} pts)`);
}
console.log('\nPARK:', JSON.stringify(out.park));
out.life.forEach((l, i) => console.log(`   life ${i}: ${l.total} people in the world, ${l.inPark} inside the park`));
await b.close();
