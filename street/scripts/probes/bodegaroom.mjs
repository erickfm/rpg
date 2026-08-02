// The bodega's "cramped / crowded" rows: F claims free run ahead 0.44 -> 2.86 m,
// left 1.01 -> 6.49 m, and aisle 0.95 -> 1.15. Measured from where you actually
// come to rest, which is the only place the complaint is about.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2000);
await p.evaluate(()=>window.__ct.warp(441.24,3.83,0,0,0)); await p.waitForTimeout(600);
const r=await p.evaluate(()=>{
  const cols=window.__ct.colliders().filter(c=>c.minX>430&&c.maxX<450&&c.minZ>-10&&c.maxZ<10);
  const [px,pz]=[441.24,3.83];
  const own=cols.filter(c=>px>c.minX-0.05&&px<c.maxX+0.05&&pz>c.minZ-0.05&&pz<c.maxZ+0.05);
  const skip=new Set(own);
  // SWEEP THE CAPSULE, not a thin ray. A ray 0 m wide threads between shelves a
  // 0.72 m player cannot, which is why my first pass read 9.55 m ahead where the
  // builder measured 2.86. Three lines - centre and both shoulders at +-0.36.
  const R=0.36;
  const hit=(x,z)=>cols.some(c=>!skip.has(c)&&x>c.minX&&x<c.maxX&&z>c.minZ&&z<c.maxZ);
  const ray=(fx,fz)=>{ const nx=-fz, nz=fx;
    for(let t=0.3;t<=14;t+=0.05){
      for(const o of [-R,0,R]){ const x=px+fx*t+nx*o, z=pz+fz*t+nz*o;
        if(hit(x,z)) return +t.toFixed(2);
        if(x<430||x>450||z<-10||z>10) return +t.toFixed(2); } }
    return 14; };
  // widest gap between colliders along a z-line down the aisle
  const gapAt=(z)=>{ const edges=[];
    for(const c of cols){ if(z>c.minZ&&z<c.maxZ) edges.push([c.minX,c.maxX]); }
    edges.sort((a,b)=>a[0]-b[0]);
    let best=0, cur=435.6;
    for(const [a,bb] of edges){ if(a>cur) best=Math.max(best,a-cur); cur=Math.max(cur,bb); }
    best=Math.max(best,444.4-cur); return +best.toFixed(2); };
  const aisles=[]; for(let z=-5;z<=5;z+=0.5) aisles.push(gapAt(z));
  return {n:cols.length, ahead:ray(0,-1), left:ray(-1,0), right:ray(1,0), back:ray(0,1),
          aisleMin:Math.min(...aisles), aisleMed:aisles.sort((a,b)=>a-b)[aisles.length>>1]}; });
console.log(`\ncolliders inside the bodega: ${r.n}`);
console.log(`from where you come to rest (441.24, 3.83):`);
console.log(`   ahead (-z, the way you face)  ${r.ahead} m      F claimed 2.86`);
console.log(`   left  (-x)                    ${r.left} m      F claimed 6.49`);
console.log(`   right (+x)                    ${r.right} m`);
console.log(`   behind                        ${r.back} m`);
console.log(`\nwidest clear gap across the room, sampled every 0.5 m in z:`);
console.log(`   narrowest ${r.aisleMin} m   median ${r.aisleMed} m      F claimed the aisle went 0.95 -> 1.15`);
console.log(`\n   player capsule is 0.72 m across`);
await b.close();
