// "when the player goes to sleep i want the screen to fade to black"
// Two separate questions, and D has already flagged that they may differ:
//   (a) does the CAPABILITY work when called directly?
//   (b) does SLEEPING actually trigger it - which is the user's request?
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
import fs from 'fs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:900,height:560}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1200);
const dec=await b.newPage(); await dec.goto('about:blank');
const lum=async(f)=>dec.evaluate(async(b64)=>{
  const img=await createImageBitmap(await (await fetch('data:image/png;base64,'+b64)).blob());
  const cv=document.createElement('canvas'); cv.width=img.width; cv.height=img.height;
  const g=cv.getContext('2d'); g.drawImage(img,0,0);
  const d=g.getImageData(0,0,cv.width,Math.floor(cv.height*0.75)).data;
  let s=0; for(let i=0;i<d.length;i+=4) s+=(d[i]+d[i+1]+d[i+2])/3;
  return +(s/(d.length/4)).toFixed(1); },fs.readFileSync(f).toString('base64'));
const sample=async(tag,ms,n)=>{ const out=[];
  for(let i=0;i<n;i++){ const f=`shots/fade-${tag}-${i}.png`; await p.screenshot({path:f});
    out.push(await lum(f)); await p.waitForTimeout(ms); }
  return out; };
console.log(`\nhud.fade present: ${await p.evaluate(()=>typeof window.__hud?.fade)}`);

// (a) the capability, called directly
await p.evaluate(()=>window.__ct.clock(22,30)); await afterFrames(p,8); await p.waitForTimeout(500);
await p.evaluate(()=>window.__ct.warp(198.3,-16.3,0,window.__ct.pos()[3],0)); await afterFrames(p,5);
const before=await lum((await p.screenshot({path:'shots/fade-a-pre.png'}),'shots/fade-a-pre.png'));
p.evaluate(()=>window.__hud.fade({ mid: () => window.__ct.advanceClock(480,0) })).catch(()=>{});
const a=await sample('a',260,14);
console.log(`\n(a) CAPABILITY called directly — luminance every 260 ms:`);
console.log(`    before ${before}`);
console.log(`    ${a.join('  ')}`);
console.log(`    floor ${Math.min(...a)}   recovered to ${a[a.length-1]}`);
console.log(`    ${Math.min(...a)<before*0.25 && a[a.length-1]>before*0.5 ? 'FADES TO BLACK AND RETURNS' : '** no fade'}`);

// (b) the user's request: sleep on the bed
await p.evaluate(()=>window.__ct.clock(22,30)); await afterFrames(p,8); await p.waitForTimeout(400);
await p.evaluate(()=>window.__ct.warp(197.4,-15.8,0,window.__ct.pos()[3],0)); await afterFrames(p,6); await p.waitForTimeout(400);
const pr=await p.evaluate(()=>{const m=(document.body.innerText||'').match(/\[E\][^\n]*/);return m?m[0].trim():null;});
const t0=await p.evaluate(()=>window.__ct.clockNow?.());
console.log(`\n(b) THE USER'S REQUEST — sleeping on the bed`);
console.log(`    prompt at the bed: ${JSON.stringify(pr)}   clock ${JSON.stringify(t0)}`);
const preB=await lum((await p.screenshot({path:'shots/fade-b-pre.png'}),'shots/fade-b-pre.png'));
await p.keyboard.press('e');
const bb=await sample('b',260,14);
const t1=await p.evaluate(()=>window.__ct.clockNow?.());
console.log(`    before ${preB}`);
console.log(`    ${bb.join('  ')}`);
console.log(`    floor ${Math.min(...bb)}   clock after ${JSON.stringify(t1)}`);
console.log(`    ${Math.min(...bb)<preB*0.25 ? 'SLEEPING FADES THE SCREEN' : '** sleeping does NOT fade the screen'}`);
await b.close();
