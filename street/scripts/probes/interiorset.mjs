// Walk every interior and audit it AS A SET. Each builder can only see their
// own room; the failure mode is that the ten do not agree with each other.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(3000);
const r=await p.evaluate(()=>{
 const dims=window.__ct.roomDims(), doors=window.__ct.doors();
 const lum=(c)=>0.299*c.r+0.587*c.g+0.114*c.b;
 const rows=[];
 for(const d of dims){
  const x0=d.cx-40, x1=d.cx+40;
  let flo=1e9, cei=-1e9, mnx=1e9,mxx=-1e9,mnz=1e9,mxz=-1e9, n=0;
  let floorLum=null, floorTex=null, sumL=0, cntL=0, tex=0, warm=0, cool=0;
  const horiz=[];
  window.__ct.scene().traverse(o=>{ if(!o.isMesh||!o.geometry)return;
   const m=o.matrixWorld.elements; if(m[12]<x0||m[12]>x1) return;
   o.geometry.computeBoundingBox(); const bb=o.geometry.boundingBox;
   let a=[1e9,1e9,1e9],c=[-1e9,-1e9,-1e9];
   for(const X of [bb.min.x,bb.max.x])for(const Y of [bb.min.y,bb.max.y])for(const Z of [bb.min.z,bb.max.z]){
    const v=[m[0]*X+m[4]*Y+m[8]*Z+m[12],m[1]*X+m[5]*Y+m[9]*Z+m[13],m[2]*X+m[6]*Y+m[10]*Z+m[14]];
    for(let i=0;i<3;i++){if(v[i]<a[i])a[i]=v[i]; if(v[i]>c[i])c[i]=v[i];}}
   n++;
   if(a[0]<mnx)mnx=a[0]; if(c[0]>mxx)mxx=c[0]; if(a[2]<mnz)mnz=a[2]; if(c[2]>mxz)mxz=c[2];
   const w=c[0]-a[0], dd=c[2]-a[2], h=c[1]-a[1];
   if(w>3&&dd>3&&h<0.35) horiz.push({y:(a[1]+c[1])/2, w, d:dd, o});
   const mat=Array.isArray(o.material)?o.material[0]:o.material;
   if(mat?.color){ const L=lum(mat.color); sumL+=L; cntL++;
     if(mat.map) tex++;
     if(mat.color.r>mat.color.b+0.02) warm++; else if(mat.color.b>mat.color.r+0.02) cool++; }
  });
  horiz.sort((u,v)=>u.y-v.y);
  const floor=horiz[0], ceil=horiz[horiz.length-1];
  if(floor){ const mat=Array.isArray(floor.o.material)?floor.o.material[0]:floor.o.material;
    floorLum=mat?.color?+lum(mat.color).toFixed(3):null; floorTex=!!mat?.map; }
  const door=doors.find(q=>q.building && q.building.toLowerCase().replace(/[^a-z]/g,'').includes(d.id.slice(0,4)));
  rows.push({id:d.id, w:d.w, dep:d.d, area:+(d.w*d.d).toFixed(1),
   floorY: floor?+floor.y.toFixed(2):null, ceilY: ceil?+ceil.y.toFixed(2):null,
   height: (floor&&ceil)?+(ceil.y-floor.y).toFixed(2):null,
   horizN: horiz.length, meshes:n,
   spanX:+(mxx-mnx).toFixed(1), spanZ:+(mxz-mnz).toFixed(1),
   floorLum, floorTex, meanLum:cntL?+(sumL/cntL).toFixed(3):null, texFrac:cntL?+(tex/cntL).toFixed(2):null,
   warm, cool, doorW: door?door.widthM:null, doorB: door?door.building:null});
 }
 const front = (window.__frontages||[]).map(f=>({n:f.name, span:+Math.abs(f.hiWorld-f.loWorld).toFixed(2)}));
 return {rows, front};});
const {rows,front}=r;
console.log('room      w x d    area  ceil  height  meshes  floorLum floorTex  meanLum texFrac warm/cool  doorW');
for(const o of rows) console.log(
 `${o.id.padEnd(9)} ${String(o.w).padStart(4)}x${String(o.dep).padEnd(4)} ${String(o.area).padStart(5)} ${String(o.ceilY).padStart(5)} ${String(o.height).padStart(6)} ${String(o.meshes).padStart(6)}  ${String(o.floorLum).padStart(7)} ${String(o.floorTex).padStart(6)}  ${String(o.meanLum).padStart(6)} ${String(o.texFrac).padStart(6)} ${String(o.warm+'/'+o.cool).padStart(9)}  ${o.doorW??'-'}`);
const num=(k)=>rows.map(o=>o[k]).filter(v=>typeof v==='number');
const st=(a)=>{const s=[...a].sort((x,y)=>x-y);return `min ${s[0]} med ${s[s.length>>1]} max ${s[s.length-1]}`;};
console.log(`\nceiling height : ${st(num('height'))}`);
console.log(`floor luminance: ${st(num('floorLum'))}`);
console.log(`mean luminance : ${st(num('meanLum'))}`);
console.log(`textured frac  : ${st(num('texFrac'))}`);
console.log(`\nfrontage spans:`); for(const f of front) console.log(`  ${f.n.padEnd(12)} ${f.span} m`);
await b.close();
