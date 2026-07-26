import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(920,0,0,0,0)); await afterFrames(p,10); await p.waitForTimeout(2000);
await setClock(p,13);
const figs=await p.evaluate(()=>{const o=[];
 window.__ct.scene().traverse(m=>{ if(!m.isMesh||!m.material?.map?.image||!m.geometry)return;
  const rep=m.material.map.repeat; if(Math.abs(rep.y)>0.9||Math.abs(rep.y)<1e-6) return;
  m.geometry.computeBoundingBox(); if(m.geometry.boundingBox.max.y-m.geometry.boundingBox.min.y<0.5) return;
  const e=m.matrixWorld.elements;
  if(e[12]<900||e[12]>940) return;
  o.push({x:+e[12].toFixed(2), z:+e[14].toFixed(2)});});
 return o;});
console.log('figures in the library room:', JSON.stringify(figs));
for(const f of figs){
 for(const [tag,dz] of [['front',-3.0],['side',0]]){
  const cx = tag==='side' ? f.x+3.0 : f.x, cz = tag==='side' ? f.z : f.z+dz;
  const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[cx,cz]);
  const yaw=Math.atan2(f.x-cx, -(f.z-cz));
  await p.evaluate(([x,z,y,g])=>window.__ct.warp(x,z,y,g,-0.03),[cx,cz,yaw,gy]);
  await afterFrames(p,4);
  const got=await p.evaluate(()=>window.__ct.pos());
  await p.screenshot({path:`shots/lb-${tag}.png`});
  console.log(`  lb-${tag}.png from (${got[0].toFixed(1)}, ${got[2].toFixed(1)}) toward (${f.x}, ${f.z})`);
 }
 break;
}
await b.close();
