// Are the interior figures BILLBOARDS? If their yaw follows the camera, then
// mesh rotation says nothing about which way a keeper is authored to face.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto('http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
const read = () => p.evaluate(() => {
  const out=[];
  window.__ct.scene().traverse(o=>{
    if(!o.isMesh||!o.geometry?.parameters) return;
    const g=o.geometry.parameters, w=g.width??0, h=g.height??0;
    if(!(w>0.9&&w<1.0&&h>1.8&&h<2.0)) return;
    const v=o.position.clone(); o.getWorldPosition(v);
    if(v.x<400) return;
    const e=new (o.rotation.constructor)();
    e.setFromQuaternion(o.getWorldQuaternion(new (o.quaternion.constructor)()),'YXZ');
    out.push({x:+v.x.toFixed(1), yaw:+e.y.toFixed(4)});
  });
  return out.sort((a,c)=>a.x-c.x);
});
const before = await read();
// stand somewhere else entirely inside a room and look the other way
await p.evaluate(()=>window.__ct.warp(760, 3.0, 1.6, 0, 0));
await p.waitForTimeout(1200);
const after = await read();
console.log(' room x    yaw @cam A   yaw @cam B   moved?');
for(let i=0;i<before.length;i++){
  const d=Math.abs(before[i].yaw-after[i].yaw);
  console.log(`  ${String(before[i].x).padStart(7)}  ${String(before[i].yaw).padStart(10)}  ${String(after[i].yaw).padStart(10)}   ${d>0.01?'YES — billboard':'no'}`);
}
await b.close();
