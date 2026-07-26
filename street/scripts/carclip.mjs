// "cars clipping into each other" in the lot, which parks HERRINGBONE at ~0.55
// rad. An AABB test is the wrong instrument here and I have the lesson written
// down already: an angled car's axis-aligned extent overlaps its neighbour's
// even when the two cars do not touch. So: oriented boxes, separated by SAT.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
// CARS FOUND BY THEIR TYRES. Scene-graph grouping cannot separate them - every
// lot mesh shares one parent, exactly as in the church - so a wide net returned
// ONE assembly. scripts/looks.mjs already identifies vehicles by the tyre black
// #101114; four tyres make a car, and their layout gives both centre and yaw,
// which is what an oriented test needs and an AABB cannot supply.
const cars=await p.evaluate(()=>{
  const s=window.__ct.scene(); s.updateMatrixWorld(true);
  const tyres=[];
  s.traverse(o=>{ if(!o.isMesh||!o.geometry) return;
    const m=Array.isArray(o.material)?o.material[0]:o.material;
    if(!m||!m.color||m.color.getHexString()!=='101114') return;
    if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const x=(bb.min.x+bb.max.x)/2, z=(bb.min.z+bb.max.z)/2, y=(bb.min.y+bb.max.y)/2;
    if(y>1.2) return;                       // a wheel, not a dark panel up high
    if(x<4||x>36||z<-52||z>-4) return;      // the lot
    tyres.push([x,z]); });
  // cluster tyres: anything within 3.2 m belongs to the same car
  const cl=[];
  for(const t of tyres){ const f=cl.find(c=>c.pts.some(q=>Math.hypot(q[0]-t[0],q[1]-t[1])<3.2));
    if(f) f.pts.push(t); else cl.push({pts:[t]}); }
  return cl.filter(c=>c.pts.length>=3).map(c=>{
    const xs=c.pts.map(q=>q[0]), zs=c.pts.map(q=>q[1]);
    const cx=xs.reduce((a,b)=>a+b,0)/xs.length, cz=zs.reduce((a,b)=>a+b,0)/zs.length;
    // principal axis of the tyre cloud = the car's long axis
    let sxx=0,szz=0,sxz=0;
    for(const [x,z] of c.pts){ const dx=x-cx, dz=z-cz; sxx+=dx*dx; szz+=dz*dz; sxz+=dx*dz; }
    const yaw=0.5*Math.atan2(2*sxz, sxx-szz);
    return {cx:+cx.toFixed(2),cz:+cz.toFixed(2),yaw:+yaw.toFixed(3),
            hx:0.85, hz:2.25, n:c.pts.length};   // nominal half-extents, width x length
  });
});
console.log(`\ncars found by tyre cluster: ${cars.length}`);
if(cars.length<2){ console.error('CANNOT ANSWER — fewer than two found.'); process.exit(3); }
for(const c of cars.slice(0,25)) console.log(`   (${c.cx}, ${c.cz})  yaw ${c.yaw}  half ${c.hx} x ${c.hz}  ${c.n} meshes`);
// 2D SAT between two oriented rectangles
const axes=(c)=>[[Math.cos(c.yaw),-Math.sin(c.yaw)],[Math.sin(c.yaw),Math.cos(c.yaw)]];
const corners=(c)=>{ const a=axes(c); const o=[];
  for(const sx of [-1,1]) for(const sz of [-1,1])
    o.push([c.cx+a[0][0]*c.hx*sx+a[1][0]*c.hz*sz, c.cz+a[0][1]*c.hx*sx+a[1][1]*c.hz*sz]);
  return o; };
const overlap=(A,B)=>{ let minPen=1e9;
  for(const c of [A,B]) for(const ax of axes(c)){
    const pa=corners(A).map(q=>q[0]*ax[0]+q[1]*ax[1]);
    const pb=corners(B).map(q=>q[0]*ax[0]+q[1]*ax[1]);
    const lo=Math.max(Math.min(...pa),Math.min(...pb)), hi=Math.min(Math.max(...pa),Math.max(...pb));
    if(hi<=lo) return 0; minPen=Math.min(minPen,hi-lo); }
  return minPen; };
let clip=0, worst=0, aabbWould=0;
for(let i=0;i<cars.length;i++) for(let j=i+1;j<cars.length;j++){
  const pen=overlap(cars[i],cars[j]);
  if(pen>0.02){ clip++; worst=Math.max(worst,pen);
    if(clip<=5) console.log(`   ** (${cars[i].cx}, ${cars[i].cz}) into (${cars[j].cx}, ${cars[j].cz}) by ${pen.toFixed(2)} m`); }
  // what a naive AABB test would have said, for contrast
  const ext=(c)=>{ const cs=corners(c); return {x0:Math.min(...cs.map(q=>q[0])),x1:Math.max(...cs.map(q=>q[0])),
                                               z0:Math.min(...cs.map(q=>q[1])),z1:Math.max(...cs.map(q=>q[1]))}; };
  const a=ext(cars[i]), bb2=ext(cars[j]);
  if(a.x1>bb2.x0&&bb2.x1>a.x0&&a.z1>bb2.z0&&bb2.z1>a.z0) aabbWould++;
}
console.log(`\n  cars actually intersecting (oriented boxes): ${clip}${clip?`, worst ${worst.toFixed(2)} m`:''}`);
console.log(`  pairs a naive AABB test would have flagged:  ${aabbWould}`);
console.log(clip? '** CARS CLIP' : 'no car intersects another');
await b.close();
