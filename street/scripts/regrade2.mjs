// Second re-grade pass: walk the church flight, walk the library courtyard, and
// re-census the park's lights over its FULL bounds -- my "8 light sources" was
// measured over a bbox of x -21..-7, which is the near seventh of a 42 m park.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 750 } });
await p.goto('http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);

const out = await p.evaluate(async () => {
  const at = async (x, z) => {
    window.__ct.warp(x, z, 0, 0.14, 0);
    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => requestAnimationFrame(r));
    const q = window.__ct.pos();
    if (Math.abs(q[0]-x) > 0.05 || Math.abs(q[2]-z) > 0.05) return null;
    return +q[3].toFixed(2);
  };
  const RAD = 0.36;
  const cols = window.__ct.colliders().filter(c => c && isFinite(c.minX) && Math.abs(c.minX) < 500);
  const free = (x,z) => !cols.some(c => x > c.minX-RAD && x < c.maxX+RAD && z > c.minZ-RAD && z < c.maxZ+RAD);
  const scan = async (x0,x1,z0,z1,st) => {
    const hits = []; let n = 0, blocked = 0;
    for (let x=x0; x<=x1; x+=st) for (let z=z0; z>=z1; z-=st) {
      if (!free(x,z)) { blocked++; continue; }          // don't measure inside solids
      const gy = await at(x,z); if (gy === null) continue;
      n++; if (gy > 0.20) hits.push([+x.toFixed(1), +z.toFixed(1), gy]);
    }
    return { n, blocked, hits, maxGy: hits.length ? Math.max(...hits.map(h=>h[2])) : 0 };
  };
  const church = await scan(-10, 16, -102, -120, 0.5);
  const lib    = await scan(-24, -5, 4, -30, 0.5);
  // park lights over the FULL park
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const P = { x0: -52, x1: -7.2, z0: -104, z1: -56 };
  let meshes=0, tall=0, glow=0; const glows=[], seats=[];
  s.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    for (let q=o; q; q=q.parent) if (q.visible === false) return;
    const g=o.geometry; if (!g.boundingBox) g.computeBoundingBox(); if (!g.boundingBox) return;
    const bb=g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const c=[(bb.min.x+bb.max.x)/2,(bb.min.y+bb.max.y)/2,(bb.min.z+bb.max.z)/2];
    if (c[0]<P.x0||c[0]>P.x1||c[2]<P.z0||c[2]>P.z1) return;
    meshes++; if (bb.max.y-bb.min.y > 2.5) tall++;
    const m=Array.isArray(o.material)?o.material[0]:o.material;
    if (m && (m.blending===2 || m.fog===false)) { glow++; glows.push([+c[0].toFixed(1),+c[1].toFixed(2),+c[2].toFixed(1)]); }
  });
  return { church, lib, park: { meshes, tall, glow, glows } };
});
const cluster = (hits) => {
  const cs=[];
  for (const [x,z,gy] of hits) {
    const c=cs.find(k=>Math.abs(k.cx-x)<3.5&&Math.abs(k.cz-z)<3.5);
    if(c){c.n++;c.x0=Math.min(c.x0,x);c.x1=Math.max(c.x1,x);c.z0=Math.min(c.z0,z);c.z1=Math.max(c.z1,z);
      c.lo=Math.min(c.lo,gy);c.hi=Math.max(c.hi,gy);c.cx=(c.x0+c.x1)/2;c.cz=(c.z0+c.z1)/2;}
    else cs.push({cx:x,cz:z,n:1,x0:x,x1:x,z0:z,z1:z,lo:gy,hi:gy});
  }
  return cs.filter(c=>c.n>=2).sort((a,c)=>c.n-a.n);
};
for (const [name,r] of [['CHURCH yard',out.church],['LIBRARY frontage/courtyard',out.lib]]) {
  console.log(`\n${name}: ${r.n} free points walked, ${r.blocked} inside solids, ${r.hits.length} raised · max gy ${r.maxGy}`);
  const cs=cluster(r.hits);
  if(!cs.length) console.log('   NO raised walkable ground above 0.20 m');
  for(const c of cs) console.log(`   x ${c.x0} … ${c.x1}   z ${c.z0} … ${c.z1}   gy ${c.lo} … ${c.hi}   (${c.n} pts)`);
}
console.log(`\nPARK over full bounds x -52…-7.2, z -104…-56:`);
console.log(`   ${out.park.meshes} meshes · ${out.park.tall} over 2.5 m · ${out.park.glow} light sources`);
for (const g of out.park.glows) console.log(`      glow at (${g[0]}, ${g[1]}, ${g[2]})`);
writeFileSync('shots/regrade2.json', JSON.stringify(out,null,2));
await b.close();
