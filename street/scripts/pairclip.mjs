// The shared-extent test I said was needed, written rather than left as a TODO.
//
// Bounding-box adjacency over-reports because a long thin band's box reaches
// places its geometry never goes. The honest question is: how close do the two
// faces' actual SURFACES come to each other?
//
// So sample face A's surface on a grid and measure each sample to face B's
// slab, and vice versa. The minimum is the real separation. A band clipped to
// the 0.3 m where it passes a wall either touches that wall or it does not, and
// no bbox corner can fake it.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
await p.goto('http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(1200);
const out = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const F = [];
  s.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    for (let q=o;q;q=q.parent) if (q.visible===false) return;
    const m=Array.isArray(o.material)?o.material[0]:o.material;
    if (!m||!m.map||!m.map.image) return;
    const g=o.geometry; if(!g.boundingBox)g.computeBoundingBox();
    const bb=g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if (bb.max.x > 400) return;
    if (bb.max.y-bb.min.y < 2 || bb.min.y > 4) return;
    const e=o.matrixWorld.elements, L=Math.hypot(e[8],e[9],e[10])||1;
    F.push({ x0:bb.min.x,x1:bb.max.x,y0:bb.min.y,y1:bb.max.y,z0:bb.min.z,z1:bb.max.z,
      n:[e[8]/L,e[9]/L,e[10]/L],
      stamped: !!(m.map.userData && m.map.userData.masonry),
      c:[(bb.min.x+bb.max.x)/2,(bb.min.y+bb.max.y)/2,(bb.min.z+bb.max.z)/2] });
  });
  const gap1=(a0,a1,c0,c1)=>(a0>c1)?a0-c1:(c0>a1)?c0-a1:0;
  const boxNear=(a,c)=>gap1(a.x0,a.x1,c.x0,c.x1)<0.6 && gap1(a.z0,a.z1,c.z0,c.z1)<0.6
                    && Math.min(a.y1,c.y1)-Math.max(a.y0,c.y0)>1.5;
  // distance from a point to a slab (0 inside)
  const ptToBox=(x,y,z,q)=>Math.hypot(
    Math.max(q.x0-x,0,x-q.x1), Math.max(q.y0-y,0,y-q.y1), Math.max(q.z0-z,0,z-q.z1));
  // sample a's surface: step across its long horizontal axis and its height
  const surfMin=(a,c)=>{
    const spanX=a.x1-a.x0, spanZ=a.z1-a.z0;
    const nx=Math.max(2,Math.min(40,Math.ceil(spanX/0.25))), nz=Math.max(2,Math.min(40,Math.ceil(spanZ/0.25)));
    const ny=Math.max(2,Math.min(12,Math.ceil((a.y1-a.y0)/0.5)));
    let best=1e9;
    for(let i=0;i<=nx;i++) for(let k=0;k<=nz;k++) for(let j=0;j<=ny;j++){
      const x=a.x0+(spanX)*(nx?i/nx:0), z=a.z0+(spanZ)*(nz?k/nz:0), y=a.y0+(a.y1-a.y0)*(ny?j/ny:0);
      const d=ptToBox(x,y,z,c); if(d<best) best=d; if(best===0) return 0;
    }
    return best;
  };
  let box=0, opposed=0, apart=0, survive=0; const kept=[];
  for(let i=0;i<F.length;i++) for(let j=i+1;j<F.length;j++){
    const a=F[i], c=F[j];
    if (a.stamped===c.stamped) continue;
    if (!boxNear(a,c)) continue;
    box++;
    const dot=a.n[0]*c.n[0]+a.n[2]*c.n[2];
    if (dot < -0.5) { opposed++; continue; }
    const d=Math.min(surfMin(a,c), surfMin(c,a));
    if (d > 0.35) { apart++; continue; }                  // surfaces never meet
    survive++; kept.push({ a:a.c.map(v=>+v.toFixed(1)), c:c.c.map(v=>+v.toFixed(1)),
      dot:+dot.toFixed(2), surfaceGap:+d.toFixed(3) });
  }
  return { faces:F.length, box, opposed, apart, survive, kept: kept.slice(0,10) };
});
console.log(`${out.faces} wall-ish textured faces\n`);
console.log(`pairs by BOUNDING BOX adjacency:                        ${out.box}`);
console.log(`   dropped — back to back (normals opposed):            ${out.opposed}`);
console.log(`   dropped — SURFACES never come within 0.35 m:         ${out.apart}`);
console.log(`   real, touching, same-side junctions:                 ${out.survive}`);
console.log(`\n   bbox over-report: ${out.box} → ${out.survive}  (${Math.round(100*(out.box-out.survive)/out.box)}% was noise)\n`);
for (const k of out.kept)
  console.log(`      (${k.a.join(',')}) vs (${k.c.join(',')})   dot ${k.dot}   surface gap ${k.surfaceGap} m`);
writeFileSync('shots/pairclip.json', JSON.stringify(out,null,2));
await b.close();
