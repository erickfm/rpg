import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{let out=null;
 window.__ct.scene().traverse(g=>{ if(out||Math.abs((g.userData?.wheelbase??0)-3.30)>0.01)return;
  const e=g.matrixWorld.elements,gx=e[12],gy=e[13],gz=e[14],yaw=Math.atan2(e[8],e[10]),c=Math.cos(yaw),s=Math.sin(yaw);
  const parts=[];
  g.traverse(o=>{if(!o.isMesh||!o.geometry)return;o.geometry.computeBoundingBox();
   const bb=o.geometry.boundingBox,m=o.matrixWorld.elements;let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
   for(const X of [bb.min.x,bb.max.x])for(const Y of [bb.min.y,bb.max.y])for(const Z of [bb.min.z,bb.max.z]){
    const wx=m[0]*X+m[4]*Y+m[8]*Z+m[12]-gx,wy=m[1]*X+m[5]*Y+m[9]*Z+m[13]-gy,wz=m[2]*X+m[6]*Y+m[10]*Z+m[14]-gz;
    const v=[c*wx-s*wz,wy,s*wx+c*wz];for(let i=0;i<3;i++){if(v[i]<mn[i])mn[i]=v[i];if(v[i]>mx[i])mx[i]=v[i];}}
   parts.push({t:o.geometry.type.replace('Geometry',''),mn:mn.map(v=>+v.toFixed(3)),mx:mx.map(v=>+v.toFixed(3)),
     col:o.material?.color?'#'+o.material.color.getHexString():null});});
  out={parts};});
 return out;});
console.log(`pickup parts, in the CAR's own frame (x=across, y=up, z=front->back):\n`);
for(const q of r.parts.sort((a,b)=>a.mn[2]-b.mn[2]))
 console.log(`  ${q.t.padEnd(10)} x ${String(q.mn[0]).padStart(7)}..${String(q.mx[0]).padEnd(7)} y ${String(q.mn[1]).padStart(6)}..${String(q.mx[1]).padEnd(6)} z ${String(q.mn[2]).padStart(7)}..${String(q.mx[2]).padEnd(7)} ${q.col||''}`);
await b.close();
