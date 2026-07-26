// Does a tyre intrude into the bed CAVITY, and does any block stick out beyond
// the silhouette of tyre and body?  Both are questions in the VEHICLE's own
// frame, so every box below is rotated back out of world into group-local.
// The pickup needs no new tag: wheelZ 1.65 is unique, so wheelbase 3.30 is it.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{
 const cars=[];
 window.__ct.scene().traverse(g=>{ if(g.userData?.wheelbase===undefined)return;
  const e=g.matrixWorld.elements, gx=e[12],gy=e[13],gz=e[14];
  const yaw=Math.atan2(e[8],e[10]);              // world yaw of the group
  const c=Math.cos(yaw), s=Math.sin(yaw);
  const parts=[];
  g.traverse(o=>{ if(!o.isMesh||!o.geometry)return; o.geometry.computeBoundingBox();
   const bb=o.geometry.boundingBox, m=o.matrixWorld.elements;
   let mn=[1e9,1e9,1e9], mx=[-1e9,-1e9,-1e9];
   for(const X of [bb.min.x,bb.max.x])for(const Y of [bb.min.y,bb.max.y])for(const Z of [bb.min.z,bb.max.z]){
    const wx=m[0]*X+m[4]*Y+m[8]*Z+m[12]-gx, wy=m[1]*X+m[5]*Y+m[9]*Z+m[13]-gy, wz=m[2]*X+m[6]*Y+m[10]*Z+m[14]-gz;
    const lx=c*wx - s*wz, lz=s*wx + c*wz;        // back into the car's own frame
    const v=[lx,wy,lz]; for(let i=0;i<3;i++){if(v[i]<mn[i])mn[i]=v[i]; if(v[i]>mx[i])mx[i]=v[i];}}
   parts.push({t:o.geometry.type,mn:mn.map(v=>+v.toFixed(3)),mx:mx.map(v=>+v.toFixed(3))});});
  cars.push({wb:+g.userData.wheelbase.toFixed(2), tyre:g.userData.tyre, x:+gx.toFixed(1), z:+gz.toFixed(1), gy:+gy.toFixed(3), parts});});
 return cars;});
console.log(`vehicles carrying a wheelbase: ${r.length}`);
const kinds={}; for(const c of r) kinds[c.wb]=(kinds[c.wb]||0)+1;
console.log('by wheelbase: '+Object.entries(kinds).map(([k,v])=>`${k}=${v}`).join('  ')+'   (pickup = 3.30)');
const picks=r.filter(c=>Math.abs(c.wb-3.30)<0.01);
console.log(`\npickups: ${picks.length}`);
// cavity, from cars.ts: floor top 0.50, rail 0.97, inner wall +-0.74, z 0.55 .. half-0.10 = 2.35
const CAV={x:0.74,y0:0.50,y1:0.97,z0:0.55,z1:2.35};
let intr=0;
for(const c of picks){
  const wheels=c.parts.filter(q=>(q.mx[1]-q.mn[1])>0.5&&(q.mx[1]-q.mn[1])<0.8&&(q.mx[0]-q.mn[0])<0.4&&q.mn[1]<0.1);
  const inside=c.parts.filter(q=> q.mn[0]<CAV.x-0.02 && q.mx[0]>-CAV.x+0.02 &&
    q.mx[1]>CAV.y0+0.02 && q.mn[1]<CAV.y1-0.02 && q.mx[2]>CAV.z0+0.02 && q.mn[2]<CAV.z1-0.02);
  const wheelsIn=inside.filter(q=>wheels.includes(q));
  console.log(`  pickup at (${c.x}, ${c.z})  ${c.parts.length} parts, ${wheels.length} wheel-like`);
  console.log(`     parts entering the cavity box: ${inside.length}   OF WHICH WHEELS: ${wheelsIn.length}`);
  for(const q of wheelsIn){intr++; console.log(`     ** WHEEL IN BED  x ${q.mn[0]}..${q.mx[0]}  y ${q.mn[1]}..${q.mx[1]}  z ${q.mn[2]}..${q.mx[2]}`);}
  if(wheels.length) console.log(`     wheel x-extent: ${Math.min(...wheels.map(q=>q.mn[0])).toFixed(3)} .. ${Math.max(...wheels.map(q=>q.mx[0])).toFixed(3)}  (inner wall at +-0.74)`);
}
// silhouette: any part outside the envelope of body+tyres, or below the road
console.log(`\nsilhouette check over all ${r.length} vehicles:`);
let out=0;
for(const c of r){
  const EX=Math.max(...c.parts.map(q=>Math.max(Math.abs(q.mn[0]),Math.abs(q.mx[0]))));
  const big=c.parts.filter(q=>(q.mx[0]-q.mn[0])>0.5||(q.mx[2]-q.mn[2])>0.5);
  const bodyX=Math.max(...big.map(q=>Math.max(Math.abs(q.mn[0]),Math.abs(q.mx[0]))));
  const bad=c.parts.filter(q=>Math.max(Math.abs(q.mn[0]),Math.abs(q.mx[0]))>bodyX+0.02 || q.mn[1]<-0.02);
  if(bad.length){out++; if(out<=5){console.log(`  ** (${c.x}, ${c.z}) wb ${c.wb}: ${bad.length} part(s) past the body envelope ${bodyX.toFixed(2)} / below the road`);
   for(const q of bad.slice(0,3))console.log(`       ${q.t} x ${q.mn[0]}..${q.mx[0]}  y ${q.mn[1]}..${q.mx[1]}`);}}
}
console.log(`vehicles with a part outside the silhouette: ${out} of ${r.length}`);
if(!r.length){console.error('CANNOT ANSWER — no vehicle carries userData.wheelbase.');process.exit(3);}
await b.close();
