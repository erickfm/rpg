// The canonical station is the GATE, arriving on foot from the pavement.
// Find it: the gap in the park's boundary colliders on the walk side.
import { chromium } from 'playwright';
import { setClock } from '../lib/clock.mjs';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(-6.2,-70,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(2000);
await setClock(p,13);
// walk the park's east boundary and find where a 0.72 m player can pass through
const gaps=await p.evaluate(()=>{
 const cols=window.__ct.colliders(); const R=0.36;
 const blocked=(x,z)=>cols.some(c=>x>c.minX-R&&x<c.maxX+R&&z>c.minZ-R&&z<c.maxZ+R);
 const open=[];
 for(let z=-58;z>=-102;z-=0.25){
  let clear=true;
  for(let x=-8.6;x<=-7.0;x+=0.2) if(blocked(x,z)) {clear=false;break;}
  if(clear) open.push(+z.toFixed(2));
 }
 const runs=[]; let cur=null;
 for(const z of open){ if(cur&&Math.abs(z-cur.b+0.25)<1e-6){cur.b=z;} else {if(cur)runs.push(cur); cur={a:z,b:z};} }
 if(cur)runs.push(cur);
 return runs.map(r=>({from:r.a,to:r.b,width:+(Math.abs(r.a-r.b)+0.25).toFixed(2)}));});
console.log('openings in the park boundary (x -8.6..-7.0), by z:');
for(const g of gaps) console.log(`   z ${g.from} … ${g.to}   ${g.width} m wide`);
const gate=gaps.sort((a,b)=>b.width-a.width)[0];
if(!gate){console.error('no opening found');process.exit(3);}
const gz=(gate.from+gate.to)/2;
console.log(`\nwidest opening = the gate, centred z ${gz.toFixed(1)}`);
// stand ON the pavement at the gate and walk in, as a player does
for(const [n,x,z,pi] of [['approach',-6.4,gz,-0.03],['in',-9.5,gz,-0.03],['inner',-13.0,gz,-0.03]]){
 const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[x,z]);
 await p.evaluate(([x,z,y,g,pi])=>window.__ct.warp(x,z,y,g,pi),[x,z,Math.atan2(-1,0),gy,pi]);
 await afterFrames(p,4); const got=await p.evaluate(()=>window.__ct.pos());
 await p.screenshot({path:`shots/gate-${n}.png`});
 console.log(`  gate-${n}.png at (${got[0].toFixed(1)}, ${got[2].toFixed(1)})`);
}
await b.close();
