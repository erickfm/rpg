// The ground profile as a PLAYER experiences it: warp to each point and read
// pos()[3], the ground the rig actually resolved. groundAt(x,z) probed from
// elsewhere is context-dependent (notes/groundat-context.md) and gave me 0.14
// for a point that resolves to 0.99 when you stand on it.
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:600,height:400}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1000);
const [x0,x1,z]=(process.env.LINE??'-4,-12,-13').split(',').map(Number);
console.log(`\nstanding profile along x ${x0} -> ${x1} at z ${z}:`);
const out=[];
const STEP=Number(process.env.STEP??0.4);
for(let x=x0;x>=x1;x-=STEP){
  await p.evaluate(([x,z])=>window.__ct.warp(x,z,0,window.__ct.groundAt(x,z),0),[x,z]);
  await afterFrames(p,3);
  const q=await p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
  const landed=Math.abs(q[0]-x)<0.5;
  out.push({x:+x.toFixed(1), gy:landed?q[3]:null});
  console.log(`   x ${String(x.toFixed(1)).padStart(6)}  ${landed?`gy ${q[3]}`:`** pushed to (${q[0]}, ${q[2]})`}`);
}
const g=out.filter(o=>o.gy!==null).map(o=>o.gy);
const lv=[...new Set(g.map(v=>v.toFixed(2)))];
console.log(`\n  distinct standing levels: ${lv.length}  ${lv.sort((a,b)=>a-b).join(' ')}`);
console.log(`  ${lv.length>=4 ? 'a graded flight — several intermediate levels you can stand on' : lv.length<=2 ? 'a STEP: two levels, nothing between' : 'shallow'}`);
await b.close();
