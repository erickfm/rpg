// Three E rows at once.
// (1) bench backs: the SITTER's facing. This world has two yaw conventions and
//     E's own check shared the bug, so state mine: a camera at yaw t looks along
//     (sin t, -cos t). seats() poses the seated camera, so that is the sitter.
// (2) prop-on-prop overlap across the park.
// (3) the shelter, which the desk ruled deleted.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{
 const PARK={x0:-42,x1:-8,z0:-102,z1:-58};
 const inPark=(x,z)=>x>PARK.x0&&x<PARK.x1&&z>PARK.z0&&z<PARK.z1;
 const cx=(PARK.x0+PARK.x1)/2, cz=(PARK.z0+PARK.z1)/2;
 // seats
 const seats=(window.__ct.seats?window.__ct.seats():[]).filter(s=>s.pose&&inPark(s.pose.x,s.pose.z));
 const sit=seats.map(s=>{
  const yaw=s.pose.yaw;
  const fx=Math.sin(yaw), fz=-Math.cos(yaw);              // camera convention
  const tx=cx-s.pose.x, tz=cz-s.pose.z, tl=Math.hypot(tx,tz)||1;
  const dot=(fx*tx+fz*tz)/tl;                              // +1 = looking at the park centre
  return {x:+s.pose.x.toFixed(1), z:+s.pose.z.toFixed(1), yaw:+yaw.toFixed(2),
          faces:+dot.toFixed(2), label:s.label};});
 // prop-on-prop overlap
 const props=[];
 window.__ct.scene().traverse(o=>{ if(!o.isMesh||!o.geometry)return; o.geometry.computeBoundingBox();
  const bb=o.geometry.boundingBox,m=o.matrixWorld.elements;
  let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  for(const X of [bb.min.x,bb.max.x])for(const Y of [bb.min.y,bb.max.y])for(const Z of [bb.min.z,bb.max.z]){
   const v=[m[0]*X+m[4]*Y+m[8]*Z+m[12],m[1]*X+m[5]*Y+m[9]*Z+m[13],m[2]*X+m[6]*Y+m[10]*Z+m[14]];
   for(let i=0;i<3;i++){if(v[i]<mn[i])mn[i]=v[i];if(v[i]>mx[i])mx[i]=v[i];}}
  const c=[(mn[0]+mx[0])/2,(mn[2]+mx[2])/2];
  if(!inPark(c[0],c[1])) return;
  const h=mx[1]-mn[1], w=mx[0]-mn[0], d=mx[2]-mn[2];
  if(h<0.25||h>3.5||w>4||d>4) return;                      // furniture-scale props only
  props.push({mn,mx,h:+h.toFixed(2)});});
 let overlaps=0, worst=null;
 for(let i=0;i<props.length;i++) for(let j=i+1;j<props.length;j++){
  const a=props[i], c=props[j];
  const ox=Math.min(a.mx[0],c.mx[0])-Math.max(a.mn[0],c.mn[0]);
  const oz=Math.min(a.mx[2],c.mx[2])-Math.max(a.mn[2],c.mn[2]);
  const oy=Math.min(a.mx[1],c.mx[1])-Math.max(a.mn[1],c.mn[1]);
  if(ox>0.05&&oz>0.05&&oy>0.05){ overlaps++;
   const vol=ox*oz*oy; if(!worst||vol>worst.vol) worst={vol:+vol.toFixed(3),ox:+ox.toFixed(2),oz:+oz.toFixed(2),oy:+oy.toFixed(2)}; }}
 // shelter?
 let shelter=0;
 window.__ct.scene().traverse(o=>{ if(!o.isMesh||!o.geometry)return;
  o.geometry.computeBoundingBox(); const bb=o.geometry.boundingBox, m=o.matrixWorld.elements;
  const w=(bb.max.x-bb.min.x)*Math.abs(m[0]||1), d=(bb.max.z-bb.min.z)*Math.abs(m[10]||1);
  if(!inPark(m[12],m[14])) return;
  if(m[13]>2.4 && w>2.5 && d>2.5) shelter++;});
 return {seats:sit, props:props.length, overlaps, worst, shelter};});
console.log(`park seats found: ${r.seats.length}`);
for(const s of r.seats) console.log(`   (${String(s.x).padStart(6)}, ${String(s.z).padStart(7)})  yaw ${String(s.yaw).padStart(6)}  sitter faces the park centre: ${s.faces>0.2?'YES':s.faces<-0.2?'** NO — faces AWAY':'sideways'}  (dot ${s.faces})`);
const bad=r.seats.filter(s=>s.faces<-0.2);
console.log(`   -> ${bad.length} of ${r.seats.length} seat a sitter facing away from the park`);
console.log(`\npark furniture meshes: ${r.props};  prop-on-prop overlaps > 5 cm on all three axes: ${r.overlaps}`);
if(r.worst) console.log(`   worst: ${r.worst.ox} x ${r.worst.oy} x ${r.worst.oz} m`);
console.log(`roof-like shelter meshes above 2.4 m and over 2.5 m across: ${r.shelter}   (desk ruled the shelter DELETED)`);
await b.close();
