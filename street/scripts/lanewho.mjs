import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto('http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
console.log(await p.evaluate(()=>{let s='';
 for(const [cx,cz] of [[-6.0,1.15],[6.0,-15.15],[-6.0,-29.4],[6.0,-45.55],[-6.0,-62.45],[6.0,-77.95]]){
  const hits=[];
  window.__ct.scene().traverse(o=>{ if(!o.isMesh||!o.geometry)return; o.geometry.computeBoundingBox();
   const bb=o.geometry.boundingBox,m=o.matrixWorld.elements; let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
   for(const X of [bb.min.x,bb.max.x])for(const Y of [bb.min.y,bb.max.y])for(const Z of [bb.min.z,bb.max.z]){
    const v=[m[0]*X+m[4]*Y+m[8]*Z+m[12],m[1]*X+m[5]*Y+m[9]*Z+m[13],m[2]*X+m[6]*Y+m[10]*Z+m[14]];
    for(let i=0;i<3;i++){if(v[i]<mn[i])mn[i]=v[i];if(v[i]>mx[i])mx[i]=v[i];}}
   if(mn[0]>cx+0.6||mx[0]<cx-0.6||mn[2]>cz+0.6||mx[2]<cz-0.6) return;
   if(mx[1]-mn[1]<0.3) return;
   hits.push(`${o.geometry.type.replace('Geometry','')} ${(mx[0]-mn[0]).toFixed(2)}x${(mx[1]-mn[1]).toFixed(2)}x${(mx[2]-mn[2]).toFixed(2)} y${mn[1].toFixed(2)}..${mx[1].toFixed(2)} ud=${JSON.stringify(o.userData)}`);});
  s+=`\n(${cx}, ${cz}) — ${hits.length} mesh(es) over 0.3 m tall:\n`+hits.slice(0,6).map(h=>'   '+h).join('\n');
 } return s;}));
await b.close();
