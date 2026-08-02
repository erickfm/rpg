import { chromium } from 'playwright';
import { setClock } from '../lib/clock.mjs';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(0,-50,0,0,0)); await p.waitForTimeout(1500);
const rl=()=>p.evaluate(()=>{let v=null;window.__ct.scene().traverse(o=>{const u=o.userData||{};
 if(u.rainLevel!==undefined)v=u.rainLevel;});return v;});
console.log('hour  rainLevel after 1.5 s');
const dry=[];
for(let h=0;h<24;h++){ await setClock(p,h); await p.waitForTimeout(1500);
 const v=await rl(); console.log(`  ${String(h).padStart(2)}   ${v===null?'-':v.toFixed(4)}`);
 if(v!==null&&v<0.5) dry.push(h); }
console.log(`\nhours whose rainLevel fell below 0.5 in 1.5 s: ${dry.join(', ')||'none'}`);
await b.close();
