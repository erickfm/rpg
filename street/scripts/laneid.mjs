import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const SPOTS=[[5.07,5.73,-35.9,-34.1],[5.15,5.55,-93.2,-92.8],[44.8,45.2,-97.9,-97.5],
 [9.74,10.36,-96.6,-96.0],[19.8,20.2,-97.9,-97.5],[13.38,13.62,-97.7,-97.5],
 [5.15,5.55,-51.2,-50.8],[5.15,5.55,-23.2,-22.8],[-5.55,-5.15,-65.2,-64.8],[33.8,34.2,-108.5,-108.1]];
console.log(await p.evaluate((SPOTS)=>{let s='';
 for(const [x0,x1,z0,z1] of SPOTS){ const hits=[];
  window.__ct.scene().traverse(o=>{if(!o.isMesh||!o.geometry)return;o.geometry.computeBoundingBox();
   const bb=o.geometry.boundingBox,m=o.matrixWorld.elements;let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
   for(const X of [bb.min.x,bb.max.x])for(const Y of [bb.min.y,bb.max.y])for(const Z of [bb.min.z,bb.max.z]){
    const v=[m[0]*X+m[4]*Y+m[8]*Z+m[12],m[1]*X+m[5]*Y+m[9]*Z+m[13],m[2]*X+m[6]*Y+m[10]*Z+m[14]];
    for(let i=0;i<3;i++){if(v[i]<mn[i])mn[i]=v[i];if(v[i]>mx[i])mx[i]=v[i];}}
   const cx=(x0+x1)/2, cz=(z0+z1)/2;
   if(mn[0]>cx+0.5||mx[0]<cx-0.5||mn[2]>cz+0.5||mx[2]<cz-0.5)return;
   if(mx[1]-mn[1]<0.2)return;
   hits.push({d:`${(mx[0]-mn[0]).toFixed(2)}w x ${(mx[1]-mn[1]).toFixed(2)}h x ${(mx[2]-mn[2]).toFixed(2)}d  top ${mx[1].toFixed(2)}`,
     ud:JSON.stringify(o.userData),h:mx[1]-mn[1]});});
  hits.sort((a,c)=>c.h-a.h);
  s+=`\n(${((x0+x1)/2).toFixed(2)}, ${((z0+z1)/2).toFixed(1)})  ${hits.length} mesh(es):\n`+
     hits.slice(0,3).map(h=>`   ${h.d}  ud=${h.ud}`).join('\n');}
 return s;},SPOTS));
await b.close();
