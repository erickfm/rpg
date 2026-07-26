// "the entrence to the tax service is not aligned with the door of the facade"
// A builder inside a room cannot see this: it needs the room AND the frontage.
// For each room: where is the interior door along its street wall, and where is
// the exterior door along that shop's frontage? Compare as a FRACTION, since
// the room and the frontage are different lengths.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto('http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{
 const dims=window.__ct.roomDims(), doors=window.__ct.doors();
 const fr=(window.__frontages||[]).map(f=>({n:f.name,axis:f.axis,lo:f.loWorld,hi:f.hiWorld,door:f.doorWorld}));
 const idOf={'BURGER BARN':'burger','DINER':'diner','THRIFT':'thrift','A-1 TAX':'tax','PAWN':'pawn','BODEGA':'bodega'};
 const out=[];
 for(const f of fr){
  const id=idOf[f.n]; if(!id) continue;
  const d=dims.find(q=>q.id===id); if(!d) continue;
  // exterior: how far along the frontage does the door sit?
  const lo=Math.min(f.lo,f.hi), hi=Math.max(f.lo,f.hi);
  const extFrac=(f.door-lo)/(hi-lo);
  // interior: find a door-shaped opening on the room's street wall.
  // Rooms sit at (cx, cz); the street wall is one of the four sides.
  const x0=d.cx-d.w/2, x1=d.cx+d.w/2, z0=d.cz-d.d/2, z1=d.cz+d.d/2;
  const cands=[];
  window.__ct.scene().traverse(o=>{ if(!o.isMesh||!o.geometry)return; o.geometry.computeBoundingBox();
   const bb=o.geometry.boundingBox,m=o.matrixWorld.elements; let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
   for(const X of [bb.min.x,bb.max.x])for(const Y of [bb.min.y,bb.max.y])for(const Z of [bb.min.z,bb.max.z]){
    const v=[m[0]*X+m[4]*Y+m[8]*Z+m[12],m[1]*X+m[5]*Y+m[9]*Z+m[13],m[2]*X+m[6]*Y+m[10]*Z+m[14]];
    for(let i=0;i<3;i++){if(v[i]<mn[i])mn[i]=v[i];if(v[i]>mx[i])mx[i]=v[i];}}
   if(mx[0]<x0-1||mn[0]>x1+1||mx[2]<z0-1||mn[2]>z1+1) return;
   const w=mx[0]-mn[0], h=mx[1]-mn[1], dp=mx[2]-mn[2];
   // a door leaf: ~1.0-1.8 wide on one axis, 1.9-2.6 tall, thin on the other
   if(h<1.8||h>2.7) return;
   const wide=Math.max(w,dp), thin=Math.min(w,dp);
   if(wide<0.8||wide>2.0||thin>0.45) return;
   cands.push({cx:+((mn[0]+mx[0])/2).toFixed(2), cz:+((mn[2]+mx[2])/2).toFixed(2),
     w:+wide.toFixed(2), h:+h.toFixed(2), onZwall: dp<w});
  });
  out.push({shop:f.n, id, frontLo:+lo.toFixed(2), frontHi:+hi.toFixed(2), extDoor:+f.door.toFixed(2),
    extFrac:+extFrac.toFixed(3), room:[d.w,d.d], cx:d.cx, cands});
 }
 return out;});
if(!r.length){console.error('CANNOT ANSWER — no shop matched a frontage to a room.');process.exit(3);}
for(const s of r){
 console.log(`\n${s.shop}  room ${s.room[0]} x ${s.room[1]} at cx ${s.cx}`);
 console.log(`  exterior: frontage ${s.frontLo}..${s.frontHi}, door at ${s.extDoor} = ${(100*s.extFrac).toFixed(1)}% along`);
 if(!s.cands.length){ console.log('  interior: no door-shaped mesh found in the room'); continue; }
 for(const c of s.cands.slice(0,4)){
  // fraction along the room's street wall (rooms are laid out along x)
  const x0=s.cx-s.room[0]/2, frac=(c.cx-x0)/s.room[0];
  console.log(`  interior: door ${c.w} x ${c.h} at x ${c.cx} = ${(100*frac).toFixed(1)}% along the room  -> ${Math.abs(frac-s.extFrac)<0.08?'ALIGNED':'** OFF by '+(100*Math.abs(frac-s.extFrac)).toFixed(0)+' % of the wall'}`);
 }
}
await b.close();
