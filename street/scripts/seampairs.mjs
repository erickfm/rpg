// THE QUESTION A SEAM AUDIT WAS ALWAYS ABOUT: does this face agree with the
// face it TOUCHES?
//
// Every density pass I have run, including my own, asked "is this face on the
// 8/16 grid". That is a proxy for agreement and it is not the same thing:
//
//   · a face at 4.09 next to one at 9.69 is a 2.4x mismatch, and my grid check
//     flagged neither of them until the masonry stamp existed
//   · a face at 8 next to one at 16 is a 2x mismatch and BOTH PASS the grid
//     check, because both are legal densities
//
// So this compares neighbours instead. Masonry faces that share space are
// paired, and the pair is judged on whether its two densities match — which is
// what a player sees at the corner where they meet.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto('http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(1200);
const out = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const faces = [];
  s.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    for (let q=o;q;q=q.parent) if (q.visible===false) return;
    const m = Array.isArray(o.material)?o.material[0]:o.material;
    if (!m || !m.map) return;
    const ms = m.map.userData && m.map.userData.masonry;
    if (!ms) return;
    const e=o.matrixWorld.elements, len=(a,b2,c)=>Math.hypot(e[a],e[b2],e[c]);
    const S=[len(0,1,2),len(4,5,6),len(8,9,10)], pr=o.geometry.parameters||{};
    const fw=(pr.width??0)*S[0], fh=(pr.height??0)*S[1];
    if (!(fw>0.05&&fh>0.05)) return;
    const img=m.map.image; if(!img) return;
    const g=o.geometry; if(!g.boundingBox)g.computeBoundingBox();
    const bb=g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    faces.push({ u:+((img.width*Math.abs(m.map.repeat.x))/fw).toFixed(2),
                 v:+((img.height*Math.abs(m.map.repeat.y))/fh).toFixed(2),
                 declared: ms.ppm,
                 x0:bb.min.x,x1:bb.max.x,y0:bb.min.y,y1:bb.max.y,z0:bb.min.z,z1:bb.max.z,
                 at:[+((bb.min.x+bb.max.x)/2).toFixed(1),+((bb.min.y+bb.max.y)/2).toFixed(1),+((bb.min.z+bb.max.z)/2).toFixed(1)] });
  });
  // neighbours: bboxes within 0.6 m in plan AND overlapping in height
  const near = (a,c) => {
    const gap = (a0,a1,c0,c1) => (a0 > c1) ? a0-c1 : (c0 > a1) ? c0-a1 : 0;
    const gx = gap(a.x0,a.x1,c.x0,c.x1), gz = gap(a.z0,a.z1,c.z0,c.z1);
    const yOverlap = Math.min(a.y1,c.y1) - Math.max(a.y0,c.y0);
    return gx < 0.6 && gz < 0.6 && yOverlap > 1.5;
  };
  const pairs = [];
  for (let i=0;i<faces.length;i++) for (let j=i+1;j<faces.length;j++) {
    if (!near(faces[i],faces[j])) continue;
    const a=faces[i], c=faces[j];
    const rU = Math.max(a.u,c.u)/Math.min(a.u,c.u);
    const rV = Math.max(a.v,c.v)/Math.min(a.v,c.v);
    pairs.push({ rU:+rU.toFixed(2), rV:+rV.toFixed(2), a:{u:a.u,v:a.v,d:a.declared,at:a.at}, c:{u:c.u,v:c.v,d:c.declared,at:c.at},
      bothOnGrid: [a.declared,c.declared].every(d=>Math.abs(d-8)<0.01||Math.abs(d-16)<0.01) });
  }
  return { nFaces: faces.length, nPairs: pairs.length, pairs };
});
console.log(`${out.nFaces} masonry faces · ${out.nPairs} touching pairs\n`);
const bad = out.pairs.filter(q => q.rU > 1.15 || q.rV > 1.15).sort((a,c)=>(c.rU*c.rV)-(a.rU*a.rV));
console.log(`pairs whose densities DISAGREE by more than 15%: ${bad.length} of ${out.nPairs}`);
const gridBlind = bad.filter(q => q.bothOnGrid);
console.log(`   of those, pairs where BOTH faces pass the 8/16 grid check: ${gridBlind.length}  <- invisible to every earlier tool\n`);
for (const q of bad.slice(0,10))
  console.log(`   u ${String(q.rU).padStart(5)}× v ${String(q.rV).padStart(5)}×   ${q.a.u}×${q.a.v} (decl ${q.a.d}) at (${q.a.at.join(',')})   vs   ${q.c.u}×${q.c.v} (decl ${q.c.d}) at (${q.c.at.join(',')})`);
writeFileSync('shots/seampairs.json', JSON.stringify(out,null,2));
await b.close();
