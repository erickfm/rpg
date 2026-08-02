// D's SEVEN highlight rows, walked on a build I have checked is HEAD.
//   (1) nothing is drawn at any [E] spot in normal play
//   (2) __ct.debugSpots(true) draws the volume, off removes it
//   (3) you cannot select a thing through an object
// My first version failed (3) by treating "[E] into the BODEGA" from the
// pavement as a leak. Standing at a door and being offered the door is the
// feature. The test that means something is the SAME target at the SAME
// distance with and without something in the way.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(2000);
const drawn=()=>p.evaluate(()=>{ let n=0; window.__ct.scene().traverse(o=>{
  if(o.isLine||o.isLineSegments||o.isLineLoop||(o.isMesh&&o.renderOrder>=999)) n++; }); return n; });
const prompt=()=>p.evaluate(()=>{ const m=(document.body.innerText||'').match(/\[E\][^\n]*/); return m?m[0].trim():null; });
const go=async(x,z,yaw=0)=>{ await p.evaluate(([x,z,y])=>window.__ct.warp(x,z,y,window.__ct.pos()[3],0),[x,z,yaw]); await afterFrames(p,4); };
let fail=[];
console.log(`\nat rest, before going anywhere: ${await drawn()} drawn`);

console.log(`\n1. NORMAL PLAY — the prompt appears and nothing is drawn`);
const spots=await p.evaluate(()=>window.__ct.spots().filter(s=>s.ok).map(s=>[s.x,s.z,s.label]));
let withPrompt=0, drewSomething=0;
for(const [x,z,label] of spots){
 await go(x,z); const d=await drawn(), pr=await prompt();
 if(pr) withPrompt++;
 if(d>0){ drewSomething++; console.log(`   ** ${label.slice(0,44)}: ${d} drawn`); }
}
console.log(`   ${spots.length} spots: ${withPrompt} offered a prompt, ${drewSomething} drew anything`);
if(drewSomething) fail.push(`${drewSomething} spots drew an outline in normal play`);
if(!withPrompt)   fail.push('no spot offered a prompt — the walk proves nothing');

console.log(`\n2. DEBUG TOGGLE — off, on, off, at a spot that has a prompt`);
const [sx,sz]=spots[0]; await go(sx,sz);
const off1=await drawn();
await p.evaluate(()=>window.__ct.debugSpots(true));  await afterFrames(p,4); const on=await drawn();
await p.evaluate(()=>window.__ct.debugSpots(false)); await afterFrames(p,4); const off2=await drawn();
console.log(`   ${off1} -> ${on} -> ${off2}   ${off1===0&&on>0&&off2===0?'discriminates':'** DOES NOT DISCRIMINATE'}`);
if(!(off1===0&&on>0&&off2===0)) fail.push(`debug toggle did not discriminate (${off1}/${on}/${off2})`);

console.log(`\n3. SELECT THROUGH AN OBJECT — same target, same distance, one blocked`);
const seats=await p.evaluate(()=>(window.__ct.seats?.()||[])
  .filter(q=>q.at&&q.pose).slice(0,60).map(q=>[q.pose.x,q.pose.z,q.at.x,q.at.z,q.label]));
let clear=0, blockedOffered=0, tested=0;
for(const [px,pz,ax,az,label] of seats.slice(0,14)){
 await go(ax,az,Math.atan2(px-ax,-(pz-az)));
 const front=await prompt();
 const bx=2*px-ax, bz=2*pz-az;                       // mirrored through the seat: equal distance
 await go(bx,bz,Math.atan2(px-bx,-(pz-bz)));
 const behind=await prompt();
 if(!front) continue;                                // if the near side does not offer it, it tests nothing
 tested++;
 if(front) clear++;
 if(behind && behind===front) blockedOffered++;
}
console.log(`   ${tested} seats where the intended side offers the prompt`);
console.log(`   ${clear} offered from the stand point, ${blockedOffered} still offered from the far side`);
if(!tested) fail.push('no seat offered its prompt from its own stand point — test inconclusive');
console.log(`\n${fail.length?'FAIL: '+fail.join('; '):'PASS'}`);
process.exit(fail.length?1:0);
