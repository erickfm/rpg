// The payphone, found BY ITS TAG. props.ts:1678 sets userData.payphone = true
// with the comment "findable by name, not by size" - which is the answer to the
// mistake I have made three times today. My size filter returned five clusters
// and none of them was ruled on; this returns the object.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{
  const s=window.__ct.scene(); s.updateMatrixWorld(true); const hits=[];
  s.traverse(o=>{ let tagged=false;
    for(let q=o;q;q=q.parent) if(q.userData&&q.userData.payphone){ tagged=true; break; }
    if(!tagged) return;
    if(!o.isMesh||!o.geometry) return;
    if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    hits.push([bb.min.x,bb.max.x,bb.min.y,bb.max.y,bb.min.z,bb.max.z]); });
  if(!hits.length) return null;
  const g=hits.reduce((a,h)=>[Math.min(a[0],h[0]),Math.max(a[1],h[1]),Math.min(a[2],h[2]),
                              Math.max(a[3],h[3]),Math.min(a[4],h[4]),Math.max(a[5],h[5])]);
  return {n:hits.length, minX:+g[0].toFixed(2),maxX:+g[1].toFixed(2),
          minY:+g[2].toFixed(2),maxY:+g[3].toFixed(2),minZ:+g[4].toFixed(2),maxZ:+g[5].toFixed(2)}; });
if(!r){ console.error('CANNOT ANSWER — nothing in the scene carries userData.payphone.'); process.exit(3); }
const depth=+(r.maxX-r.minX).toFixed(2), width=+(r.maxZ-r.minZ).toFixed(2);
console.log(`\npayphone: ${r.n} meshes`);
console.log(`  x ${r.minX} .. ${r.maxX}   (${depth} m across the walk)`);
console.log(`  z ${r.minZ} .. ${r.maxZ}   (${width} m along the walk)`);
console.log(`  y ${r.minY} .. ${r.maxY}   (${(r.maxY-r.minY).toFixed(2)} m tall)`);
// what walk is left beside it, and where the walkers run
const clear=await p.evaluate(([minX,maxX,minZ,maxZ])=>{
  const cs=window.__ct.colliders();
  const z=(minZ+maxZ)/2;
  // scan across the walk at the phone's z: find the widest free run
  const edges=[];
  for(const c of cs) if(z>c.minZ&&z<c.maxZ&&c.maxX>-12&&c.minX<12) edges.push([c.minX,c.maxX]);
  edges.sort((a,b)=>a[0]-b[0]);
  let best=0, from=0, to=0, cur=-12;
  for(const [a,b2] of edges){ if(a>cur&&a-cur>best){ best=a-cur; from=cur; to=a; } cur=Math.max(cur,b2); }
  if(12-cur>best){ best=12-cur; from=cur; to=12; }
  return {best:+best.toFixed(2), from:+from.toFixed(2), to:+to.toFixed(2), z:+z.toFixed(2)}; },
  [r.minX,r.maxX,r.minZ,r.maxZ]);
console.log(`\nwidest clear run across the street at z ${clear.z}: ${clear.best} m  (x ${clear.from} .. ${clear.to})`);
console.log(`  player capsule 0.72 m; B's ceiling for anything against a facade was 0.45 m deep`);
console.log(`  the phone is ${depth} m deep — ${depth<=0.46?'within it':'** DEEPER than 0.45 m'}`);
await b.close();
