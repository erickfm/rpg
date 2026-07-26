// D's SEVEN highlight rows, walked. Claims: (1) no outline is drawn in normal
// play at any [E] spot, (2) __ct.debugSpots(true) draws the trigger volume and
// off removes it, (3) you cannot select a thing through a wall.
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(2000);
const count=()=>p.evaluate(()=>{ let lines=0,meshes=0;
  window.__ct.scene().traverse(o=>{ if(o.isLine||o.isLineSegments||o.isLineLoop) lines++;
    if(o.isMesh&&o.renderOrder>=999) meshes++; });
  return {lines,meshes}; });
const prompt=()=>p.evaluate(()=>{ const t=document.body.innerText||'';
  const m=t.match(/\[E\][^\n]*/); return m?m[0].trim():null; });
const spots=await p.evaluate(()=>window.__ct.spots().filter(s=>s.ok).map(s=>[s.x,s.z,s.label]));
console.log(`\n1. NORMAL PLAY — prompt should appear, nothing should be drawn`);
let bad=0, shown=0;
for(const [x,z,label] of spots.slice(0,10)){
 await p.evaluate(([x,z])=>window.__ct.warp(x,z,0,window.__ct.pos()[3],0),[x,z]);
 await afterFrames(p,4);
 const c=await count(), pr=await prompt();
 if(pr) shown++;
 if(c.lines>0||c.meshes>0){ bad++; console.log(`   ** ${label}: ${c.lines} lines, ${c.meshes} renderOrder-999 meshes`); }
 else console.log(`   ok  ${label.slice(0,38).padEnd(38)} prompt ${pr?JSON.stringify(pr):'(none)'}  drawn 0`);
}
console.log(`   ${spots.slice(0,10).length-bad} of ${spots.slice(0,10).length} spots draw nothing; ${shown} showed a prompt`);
console.log(`\n2. DEBUG TOGGLE — off, on, off`);
const [x0,z0]=spots[0];
await p.evaluate(([x,z])=>window.__ct.warp(x,z,0,window.__ct.pos()[3],0),[x0,z0]); await afterFrames(p,4);
const off1=await count();
let on=null, off2=null, err=null;
try{ await p.evaluate(()=>window.__ct.debugSpots(true)); await afterFrames(p,4); on=await count();
     await p.evaluate(()=>window.__ct.debugSpots(false)); await afterFrames(p,4); off2=await count(); }
catch(e){ err=e.message; }
if(err) console.log(`   ** debugSpots threw: ${err}`);
else console.log(`   off ${off1.lines+off1.meshes} drawn -> on ${on.lines+on.meshes} -> off ${off2.lines+off2.meshes}`
  +`   ${off1.lines+off1.meshes===0&&on.lines+on.meshes>0&&off2.lines+off2.meshes===0?'discriminates':'** DOES NOT DISCRIMINATE'}`);
console.log(`\n3. SELECTION THROUGH WALLS — on the pavement outside four shops`);
let leaks=0;
for(const [n,x,z] of [['bodega',7.9,-93.4],['burger',-6.3,-25.1],['diner',-6.3,-46.6],['pawn',-6.3,-60.0]]){
 await p.evaluate(([x,z])=>window.__ct.warp(x,z,0,window.__ct.pos()[3],0),[x,z]); await afterFrames(p,4);
 const pr=await prompt();
 const inside=pr&&!/enter|open|door|street|cross/i.test(pr);
 if(inside){ leaks++; console.log(`   ** ${n}: offered ${JSON.stringify(pr)} from the pavement`); }
 else console.log(`   ok  ${n.padEnd(7)} prompt ${pr?JSON.stringify(pr):'(none)'}`);
}
console.log(`   ${leaks} leaks`);
const fail = bad>0 || err || !(off1.lines+off1.meshes===0&&on&&on.lines+on.meshes>0&&off2.lines+off2.meshes===0) || leaks>0;
console.log(`\n${fail?'FAIL':'PASS'}`); process.exit(fail?1:0);
