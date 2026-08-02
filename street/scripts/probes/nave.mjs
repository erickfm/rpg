// "the church interior is reversed ... the entrance/exit is at the altar [end]"
// G's test: walk in and hold forward - 0.51 m before, 11.71 m after.
// Measure it as the player actually is: a disc of radius 0.36 down the aisle.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const R=0.36;
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
console.log(await p.evaluate(([R])=>{
 const d=window.__ct.roomDims().find(q=>q.id==='church');
 const cols=window.__ct.colliders();
 const blocked=(x,z)=>cols.some(c=>x>c.minX-R&&x<c.maxX+R&&z>c.minZ-R&&z<c.maxZ+R);
 let s=`church room ${d.w} x ${d.d} at (${d.cx}, ${d.cz})\n`;
 // walk the centre line from each end and see how far a 0.36 disc gets
 for(const [name,from,dir] of [['from the +z end (the door)', d.cz+d.d/2-0.5, -1],
                               ['from the -z end (the altar)', d.cz-d.d/2+0.5, +1]]){
  let run=0, z=from;
  for(let t=0;t<d.d;t+=0.05){ const zz=from+dir*t; if(blocked(d.cx,zz)) break; run=t; z=zz; }
  s+=`  ${name}: clear run ${run.toFixed(2)} m, stops at z ${z.toFixed(2)}\n`;
 }
 // where along the centre line is anything solid at all?
 const hits=[];
 for(let t=0;t<d.d;t+=0.1){ const zz=d.cz-d.d/2+t; if(blocked(d.cx,zz)) hits.push(+zz.toFixed(1)); }
 s+=`  solid points on the centre line: ${hits.length?hits.slice(0,10).join(', '):'none'}\n`;
 // and where are the altar and the door in z?
 let altar=null;
 window.__ct.scene().traverse(o=>{ if(!o.isMesh||!o.geometry)return;
  const e=o.matrixWorld.elements; if(Math.abs(e[12]-d.cx)>6||e[12]<600||e[12]>760) return;
  o.geometry.computeBoundingBox(); const bb=o.geometry.boundingBox;
  const w=(bb.max.x-bb.min.x), h=(bb.max.y-bb.min.y), dd=(bb.max.z-bb.min.z);
  if(w>1.6&&w<4&&h>0.7&&h<1.3&&dd>0.5&&dd<1.6&&e[13]<1.2){ if(!altar||e[14]<altar) altar=+e[14].toFixed(2); }});
 s+=`  altar-like object at z ${altar}\n`;
 return s;},[R]));
await b.close();
