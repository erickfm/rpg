// Targeted: for each 0.56 x 1.4 pit, look for the trunk DIRECTLY ABOVE it rather
// than globally - a global search pairs pits with lamp posts.
// Also check the kerb strip: B says 0.117 m of paving between pit and kerb.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
console.log(await p.evaluate(()=>{
 const boxes=[];
 window.__ct.scene().traverse(o=>{ if(!o.isMesh||!o.geometry)return;
  o.geometry.computeBoundingBox(); const bb=o.geometry.boundingBox,m=o.matrixWorld.elements;
  let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  for(const X of [bb.min.x,bb.max.x])for(const Y of [bb.min.y,bb.max.y])for(const Z of [bb.min.z,bb.max.z]){
   const v=[m[0]*X+m[4]*Y+m[8]*Z+m[12],m[1]*X+m[5]*Y+m[9]*Z+m[13],m[2]*X+m[6]*Y+m[10]*Z+m[14]];
   for(let i=0;i<3;i++){if(v[i]<mn[i])mn[i]=v[i];if(v[i]>mx[i])mx[i]=v[i];}}
  if(mn[0]>200) return; boxes.push({mn,mx});});
 const pits=boxes.filter(q=>{const w=q.mx[0]-q.mn[0],h=q.mx[1]-q.mn[1],d=q.mx[2]-q.mn[2];
  return h<0.1 && Math.abs(w-0.56)<0.02 && Math.abs(d-1.4)<0.02;});
 let s=`pits measuring 0.56 x 1.4: ${pits.length}\n\n`;
 s+='  pit centre x    z        trunk x    offset    kerb strip   ground under the near edge\n';
 for(const q of pits.sort((a,b)=>b.mn[2]-a.mn[2])){
  const cx=(q.mn[0]+q.mx[0])/2, cz=(q.mn[2]+q.mx[2])/2;
  // trunk = anything tall whose xz centre sits over this pit
  const t=boxes.filter(o=>{const ox=(o.mn[0]+o.mx[0])/2, oz=(o.mn[2]+o.mx[2])/2;
    return o.mx[1]>1.2 && Math.abs(ox-cx)<0.45 && Math.abs(oz-cz)<0.45 && (o.mx[0]-o.mn[0])<1.2;})
   .sort((a,b)=>(a.mx[1]-a.mn[1])-(b.mx[1]-b.mn[1]))[0];
  const tx = t ? (t.mn[0]+t.mx[0])/2 : null;
  const kerb = cx>0 ? 5.25 : -5.25;
  const nearEdge = cx>0 ? q.mn[0] : q.mx[0];
  const strip = Math.abs(Math.abs(nearEdge)-Math.abs(kerb));
  const g = window.__ct.groundAt(nearEdge + (cx>0?0.02:-0.02), cz);
  s+=`   ${cx.toFixed(3).padStart(8)} ${cz.toFixed(1).padStart(8)}   ${tx===null?'  none  ':tx.toFixed(3).padStart(8)}  ${tx===null?'   -   ':((tx-cx)>=0?'+':'')+(tx-cx).toFixed(3).padStart(7)}   ${strip.toFixed(3)}        ${g.toFixed(2)}\n`;
 }
 s+=`\n  kerb line taken as |x| = 5.25 (the walk edge from groundAt)\n`;
 return s;}));
await b.close();
