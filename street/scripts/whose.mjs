// WHO OWNS THE 12 MIRRORED FACES? Asked, not inferred.
//
// I attributed them to ct/lot.ts by position and said in the report that the
// claim was circumstantial. C's userData.mod stamp (cf966b3d) makes it a
// lookup: walk up from each mesh for an inherited mark.
//
// A's note records that their first probe returned zero stamps and was testing
// a stale dist. This runs against a fresh build for that reason.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, process.env.SHOT_URL ?? 'http://localhost:4184/');   // GOTCHAS 26: prove it, do not just name it
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);
const out = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const modOf = (o) => { for (let q = o; q; q = q.parent) if (q.userData && q.userData.mod) return q.userData.mod; return null; };
  let stamped = 0, total = 0; const tally = {};
  const tf = (o, v) => { const e = o.matrixWorld.elements;
    const x=e[0]*v.x+e[4]*v.y+e[8]*v.z, y=e[1]*v.x+e[5]*v.y+e[9]*v.z, z=e[2]*v.x+e[6]*v.y+e[10]*v.z;
    const L=Math.hypot(x,y,z)||1; return {x:x/L,y:y/L,z:z/L}; };
  const mirrored = [];
  s.traverse(o => {
    if (!o.isMesh) return; total++;
    const m0 = modOf(o); if (m0) { stamped++; tally[m0] = (tally[m0]||0)+1; }
    if (!o.geometry || o.geometry.type !== 'PlaneGeometry') return;
    for (let q=o;q;q=q.parent) if (q.visible===false) return;
    const m = Array.isArray(o.material)?o.material[0]:o.material;
    if (!m || !m.map) return;
    const g=o.geometry; if(!g.boundingBox)g.computeBoundingBox();
    const bb=g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if (bb.min.y < 1.2) return;
    const up = tf(o,{x:0,y:1,z:0}); if (Math.abs(up.y) < 0.7) return;
    const N = tf(o,{x:0,y:0,z:1}), U = tf(o,{x:1,y:0,z:0});
    const dot = U.x*N.z + U.z*(-N.x);
    if (dot >= -0.001) return;
    mirrored.push({ at:[+((bb.min.x+bb.max.x)/2).toFixed(2),+((bb.min.y+bb.max.y)/2).toFixed(2),+((bb.min.z+bb.max.z)/2).toFixed(2)],
      size:[+(bb.max.x-bb.min.x).toFixed(2),+(bb.max.y-bb.min.y).toFixed(2),+(bb.max.z-bb.min.z).toFixed(2)],
      canvas:[m.map.image.width, m.map.image.height], mod: m0 });
  });
  return { total, stamped, tally, mirrored };
});
console.log(`${out.stamped} of ${out.total} meshes carry userData.mod`);
for (const [k,v] of Object.entries(out.tally)) console.log(`   ${String(v).padStart(4)}  ${k}`);
console.log(`\n${out.mirrored.length} MIRRORED upright mapped faces:`);
for (const q of out.mirrored)
  console.log(`   ${q.size.join('×')}  canvas ${q.canvas.join('×')}  at (${q.at.join(', ')})   owner: ${q.mod ?? '(unattributed)'}`);
writeFileSync('shots/whose.json', JSON.stringify(out,null,2));
await b.close();
