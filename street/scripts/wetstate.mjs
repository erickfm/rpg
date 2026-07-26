// material.color is a TINT and reads 1.000 on every textured surface - it cannot
// see wetness. Read the world's own `wetness` state instead, which is the unit
// the desk quotes (road 0.2508 -> 0.5540 -> 0.7356 after the rain stops).
import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(0,-50,0,0,0));
await p.waitForTimeout(2000);
const probe=()=>p.evaluate(()=>{
 const vals=[]; let rainLevel=null;
 window.__ct.scene().traverse(o=>{ const u=o.userData||{};
  if(u.rainLevel!==undefined) rainLevel=u.rainLevel;
  if(typeof u.wetness==='number') vals.push(u.wetness); });
 vals.sort((a,b)=>a-b);
 return {n:vals.length, min:vals[0], med:vals[vals.length>>1], max:vals[vals.length-1], rainLevel};});
const show=async(label)=>{const r=await probe();
 console.log(`  ${label.padEnd(34)} n=${r.n}  wetness min ${r.min} med ${r.med} max ${r.max}   rainLevel ${r.rainLevel}`);};
await setClock(p,14); await p.waitForTimeout(4000);
await show('during rain (14:00), settled');
await p.waitForTimeout(8000);
await show('still raining, +8 s');
await setClock(p,16);
for(const [lbl,ms] of [['~1 s after it stops',1000],['~5 s after',4000],['~9 s after',4000],['~14 s after',5000]]){
 await p.waitForTimeout(ms); await show(lbl);}
await b.close();
