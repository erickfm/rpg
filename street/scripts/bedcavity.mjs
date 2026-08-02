// Does a tyre intrude into the bed CAVITY, and does any block stick out beyond
// the silhouette of tyre and body?  Both are questions in the VEHICLE's own
// frame, so every box below is rotated back out of world into group-local.
// The pickup needs no new tag: wheelZ 1.65 is unique, so wheelbase 3.30 is it.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
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
// The cavity box used to be a hand-typed constant lifted from a reading of
// cars.ts (CAV.x = 0.74) taken BEFORE the wheel well existed — it was the
// bed's outer wall, not the well's inner wall. `f67796741` built a real well
// (GOTCHAS 56 / 48/54-class staleness): an inner wall box, BoxGeometry(0.04,
// WELL_TOP-FLOOR_T, 0.86), standing between the tyre and the load space. That
// retyped 0.74 went stale the moment the well shipped and sat wrong for a
// week, contradicting builder H's correct "cannot reproduce".
//
// So: don't retype cars.ts's constants a second time. FIND the well's inner
// wall in the scene and read the cavity bound off IT — a thin (~0.04 m) box,
// ~0.1-0.35 m tall, ~0.5-1.2 m long, standing well off the car's centreline.
// Nothing else on a parked pickup matches that shape (checked against every
// BoxGeometry cars.ts creates: the outer walls are 0.16 m thick, the well lid
// is 0.68 m wide but only 0.04 m tall, the jack post is 0.09 m thick and the
// engine-bay/on-blocks boxes are all wider still). If the well is ever
// rebuilt again this derivation moves with it instead of rotting a second time.
let intr=0;
for(const c of picks){
  const wheels=c.parts.filter(q=>(q.mx[1]-q.mn[1])>0.5&&(q.mx[1]-q.mn[1])<0.8&&(q.mx[0]-q.mn[0])<0.4&&q.mn[1]<0.1);
  const wellParts=c.parts.filter(q=>{
    const dx=q.mx[0]-q.mn[0], dy=q.mx[1]-q.mn[1], dz=q.mx[2]-q.mn[2];
    return dx>0.01&&dx<0.08 && dy>0.1&&dy<0.35 && dz>0.5&&dz<1.2 && Math.abs((q.mn[0]+q.mx[0])/2)>0.3;
  });
  console.log(`  pickup at (${c.x}, ${c.z})  ${c.parts.length} parts, ${wheels.length} wheel-like, ${wellParts.length} well-wall part(s) found`);
  if(!wellParts.length){
    console.log('     CANNOT DERIVE A CAVITY — no well-wall geometry matched the shape filter; skipping this vehicle');
    continue;
  }
  const CAV={
    x:  Math.min(...wellParts.map(q=>Math.min(Math.abs(q.mn[0]),Math.abs(q.mx[0])))),   // well's inner face
    y0: Math.min(...wellParts.map(q=>q.mn[1])),                                          // floor level
    y1: Math.max(...wellParts.map(q=>q.mx[1])),                                          // well top
    z0: Math.min(...wellParts.map(q=>q.mn[2])),
    z1: Math.max(...wellParts.map(q=>q.mx[2])),
  };
  console.log(`     derived cavity: x<${CAV.x.toFixed(3)}  y ${CAV.y0.toFixed(3)}..${CAV.y1.toFixed(3)}  z ${CAV.z0.toFixed(3)}..${CAV.z1.toFixed(3)}`);
  const inside=c.parts.filter(q=> q.mn[0]<CAV.x-0.02 && q.mx[0]>-CAV.x+0.02 &&
    q.mx[1]>CAV.y0+0.02 && q.mn[1]<CAV.y1-0.02 && q.mx[2]>CAV.z0+0.02 && q.mn[2]<CAV.z1-0.02);
  const wheelsIn=inside.filter(q=>wheels.includes(q));
  console.log(`     parts entering the cavity box: ${inside.length}   OF WHICH WHEELS: ${wheelsIn.length}`);
  for(const q of wheelsIn){intr++; console.log(`     ** WHEEL IN BED  x ${q.mn[0]}..${q.mx[0]}  y ${q.mn[1]}..${q.mx[1]}  z ${q.mn[2]}..${q.mx[2]}`);}
  if(wheels.length) console.log(`     wheel x-extent: ${Math.min(...wheels.map(q=>q.mn[0])).toFixed(3)} .. ${Math.max(...wheels.map(q=>q.mx[0])).toFixed(3)}  (well's inner face at +-${CAV.x.toFixed(3)})`);
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
if(intr>0||out>0){console.error(`FAIL: ${intr} wheel(s) in a bed cavity, ${out} vehicle(s) with a part outside the silhouette`);process.exit(1);}
console.log('\nPASS: no wheel intrudes into its bed cavity, no part sits outside its vehicle silhouette');
