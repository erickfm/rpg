// The seam check with BOTH bugs fixed: mainline's per-face density (a box's
// four side faces are not all parameters.width across) and my surface-proximity
// pairing (a bounding box is not the shape).
//
// Everything before this combined at least one broken half, which is why the
// numbers moved so much. This is the first run where both halves are sound.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(1200);
const out = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const F = [];
  s.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    for (let q=o;q;q=q.parent) if (q.visible===false) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const g=o.geometry; if(!g.boundingBox)g.computeBoundingBox();
    const bb=g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if (bb.max.x > 400) return;
    if (bb.max.y-bb.min.y < 2 || bb.min.y > 4) return;
    mats.forEach((m, mi) => {
      if (!m || !m.map || !m.map.image) return;
      const ms = (m.map.userData && m.map.userData.masonry) || null;
      const e=o.matrixWorld.elements, len=(a,b2,c)=>Math.hypot(e[a],e[b2],e[c]);
      const S=[len(0,1,2),len(4,5,6),len(8,9,10)], pr=o.geometry.parameters||{};
      let fw, fh, nrm;
      if (o.geometry.type === 'BoxGeometry') {          // [+x,-x,+y,-y,+z,-z]
        if (mi===0||mi===1)      { fw=(pr.depth??0)*S[2]; fh=(pr.height??0)*S[1]; nrm=[mi===0?1:-1,0,0]; }
        else if (mi===4||mi===5) { fw=(pr.width??0)*S[0]; fh=(pr.height??0)*S[1]; nrm=[0,0,mi===4?1:-1]; }
        else return;                                     // top/bottom: not a wall
      } else {
        fw=(pr.width??0)*S[0]; fh=(pr.height??0)*S[1];
        const L=Math.hypot(e[8],e[9],e[10])||1; nrm=[e[8]/L,e[9]/L,e[10]/L];
      }
      if (!(fw>0.05&&fh>0.05)) return;
      const img=m.map.image, rep=m.map.repeat;
      F.push({ u:+((img.width*Math.abs(rep.x))/fw).toFixed(2),
               v:+((img.height*Math.abs(rep.y))/fh).toFixed(2),
               stamped: !!ms, ppm: ms?ms.ppm:null, n:nrm,
               x0:bb.min.x,x1:bb.max.x,y0:bb.min.y,y1:bb.max.y,z0:bb.min.z,z1:bb.max.z,
               c:[(bb.min.x+bb.max.x)/2,(bb.min.y+bb.max.y)/2,(bb.min.z+bb.max.z)/2] });
    });
  });
  const gap1=(a0,a1,c0,c1)=>(a0>c1)?a0-c1:(c0>a1)?c0-a1:0;
  const ptToBox=(x,y,z,q)=>Math.hypot(Math.max(q.x0-x,0,x-q.x1),Math.max(q.y0-y,0,y-q.y1),Math.max(q.z0-z,0,z-q.z1));
  const surfMin=(a,c)=>{const sx=a.x1-a.x0,sz=a.z1-a.z0;
    const nx=Math.max(2,Math.min(32,Math.ceil(sx/0.3))),nz=Math.max(2,Math.min(32,Math.ceil(sz/0.3))),ny=4;
    let best=1e9;
    for(let i=0;i<=nx;i++)for(let k=0;k<=nz;k++)for(let j=0;j<=ny;j++){
      const d=ptToBox(a.x0+sx*(i/nx), a.y0+(a.y1-a.y0)*(j/ny), a.z0+sz*(k/nz), c);
      if(d<best)best=d; if(best===0)return 0;} return best;};
  let considered=0; const dis=[]; let agree=0;
  for(let i=0;i<F.length;i++)for(let j=i+1;j<F.length;j++){
    const a=F[i], c=F[j];
    if (gap1(a.x0,a.x1,c.x0,c.x1)>0.6||gap1(a.z0,a.z1,c.z0,c.z1)>0.6) continue;
    if (Math.min(a.y1,c.y1)-Math.max(a.y0,c.y0) <= 1.5) continue;
    if (a.n[0]*c.n[0]+a.n[2]*c.n[2] < -0.5) continue;                 // back to back
    if (Math.min(surfMin(a,c), surfMin(c,a)) > 0.35) continue;        // surfaces never meet
    considered++;
    const r=Math.max(a.u,c.u)/Math.min(a.u,c.u);
    if (r > 1.15) dis.push({ r:+r.toFixed(2), a:{u:a.u,ppm:a.ppm,st:a.stamped,c:a.c.map(v=>+v.toFixed(1))},
                             c:{u:c.u,ppm:c.ppm,st:c.stamped,c:c.c.map(v=>+v.toFixed(1))} });
    else agree++;
  }
  return { faces:F.length, considered, agree, dis: dis.sort((x,y)=>y.r-x.r) };
});
console.log(`${out.faces} wall faces (per-face, box sides indexed correctly)`);
console.log(`REAL junctions — surfaces within 0.35 m, same side, height-overlapping: ${out.considered}`);
console.log(`   agree within 15%:  ${out.agree}`);
console.log(`   DISAGREE:          ${out.dis.length}\n`);
for (const d of out.dis.slice(0,12))
  console.log(`   ${String(d.r).padStart(5)}×   ${String(d.a.u).padStart(6)} (${d.a.st?'declared '+d.a.ppm:'unstamped'}) at (${d.a.c.join(',')})` +
              `   vs ${String(d.c.u).padStart(6)} (${d.c.st?'declared '+d.c.ppm:'unstamped'}) at (${d.c.c.join(',')})`);
writeFileSync('shots/seamreal.json', JSON.stringify(out,null,2));
await b.close();
