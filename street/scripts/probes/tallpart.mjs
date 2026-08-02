import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
console.log(await p.evaluate(()=>{let s='';
 window.__ct.scene().traverse(g=>{ if(s||Math.abs((g.userData?.wheelbase??0)-3.30)>0.01)return;
  const gy=g.matrixWorld.elements[13];
  g.traverse(o=>{if(!o.isMesh||!o.geometry)return; o.geometry.computeBoundingBox();
   const bb=o.geometry.boundingBox,m=o.matrixWorld.elements; let hi=-1e9,lo=1e9;
   for(const X of [bb.min.x,bb.max.x])for(const Y of [bb.min.y,bb.max.y])for(const Z of [bb.min.z,bb.max.z]){
    const wy=m[1]*X+m[5]*Y+m[9]*Z+m[13]-gy; if(wy>hi)hi=wy; if(wy<lo)lo=wy;}
   if(hi<1.6)return;
   const pos=o.geometry.attributes?.position; let vhi=-1e9;
   if(pos)for(let i=0;i<pos.count;i++){const X=pos.getX(i),Y=pos.getY(i),Z=pos.getZ(i);
    const wy=m[1]*X+m[5]*Y+m[9]*Z+m[13]-gy; if(wy>vhi)vhi=wy;}
   s+=`name "${o.name}"  type ${o.geometry.type}  visible=${o.visible}\n`+
      `  geometry bbox  x ${bb.min.x.toFixed(2)}..${bb.max.x.toFixed(2)}  y ${bb.min.y.toFixed(2)}..${bb.max.y.toFixed(2)}  z ${bb.min.z.toFixed(2)}..${bb.max.z.toFixed(2)}\n`+
      `  AABB of the 8 CORNERS   top ${hi.toFixed(3)}  bottom ${lo.toFixed(3)}\n`+
      `  TOP OF ANY REAL VERTEX  ${vhi.toFixed(3)}   over ${pos?pos.count:0} verts\n`+
      `  rotation x ${o.rotation.x.toFixed(3)} y ${o.rotation.y.toFixed(3)} z ${o.rotation.z.toFixed(3)}\n`;});});
 return s||'nothing reaches 1.6 m';}));
await b.close();
