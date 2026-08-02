// C's claim is about the GRADE, not absolute brightness: "the night grade dims
// the plastic while the glass stays bright". Comparing screen against surround
// on one frame tests neither - a CRT showing green-on-black is darker than white
// plastic at any hour. The test is the SAME surface, day against night.
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
import fs from 'fs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1000,height:640}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1200);
const dec=await b.newPage(); await dec.goto('about:blank');
const mean=async(f,x0,y0,x1,y1)=>dec.evaluate(async([b64,x0,y0,x1,y1])=>{
  const img=await createImageBitmap(await (await fetch('data:image/png;base64,'+b64)).blob());
  const cv=document.createElement('canvas'); cv.width=img.width; cv.height=img.height;
  const g=cv.getContext('2d'); g.drawImage(img,0,0);
  const d=g.getImageData(x0,y0,x1-x0,y1-y0).data;
  let s=0; for(let i=0;i<d.length;i+=4) s+=(d[i]+d[i+1]+d[i+2])/3;
  return +(s/(d.length/4)).toFixed(1); },[fs.readFileSync(f).toString('base64'),x0,y0,x1,y1]);
const shot=async(h,tag)=>{
  await p.evaluate((h)=>window.__ct.clock(h,10),h); await afterFrames(p,8); await p.waitForTimeout(700);
  await p.evaluate(()=>window.__ct.warp(198.30,-16.30,0,window.__ct.pos()[3],0)); await afterFrames(p,5);
  const f=`shots/bez-${tag}.png`; await p.screenshot({path:f}); return f; };
// MANY FRAMES PER HOUR. The screen's content changes every few seconds, so one
// frame at each hour compares an ad as much as a grade. Take the median over ten.
const many=async(h,tag)=>{ const fs2=[];
  await p.evaluate((h)=>window.__ct.clock(h,10),h); await afterFrames(p,8); await p.waitForTimeout(700);
  await p.evaluate(()=>window.__ct.warp(198.30,-16.30,0,window.__ct.pos()[3],0)); await afterFrames(p,5);
  for(let i=0;i<10;i++){ const f=`shots/bez-${tag}-${i}.png`; await p.screenshot({path:f}); fs2.push(f); await p.waitForTimeout(1800); }
  return fs2; };
const dayF=await many(13,'day'), nightF=await many(23,'night');
const med=async(files,box)=>{ const v=[]; for(const f of files) v.push(await mean(f,...box));
  v.sort((a,b)=>a-b); return +v[v.length>>1].toFixed(1); };
const day=dayF[0], night=nightF[0];
const R={ 'screen (glass)':[560,388,626,430], 'bezel rail above':[548,372,640,384],
          'bezel rail below':[548,442,640,458], 'wall beside it':[760,380,860,440] };
console.log(`\n region                 13:10    23:10   night/day`);
const out={};
for(const [k,v] of Object.entries(R)){
  const d=await med(dayF,v), n=await med(nightF,v);
  out[k]=n/d;
  console.log(`  ${k.padEnd(20)} ${String(d).padStart(6)} ${String(n).padStart(8)}    ${(n/d).toFixed(3)}`);
}
const sur=(out['bezel rail above']+out['bezel rail below'])/2;
console.log(`\n  surround keeps ${(sur*100).toFixed(0)}% of its daylight; the glass keeps ${(out['screen (glass)']*100).toFixed(0)}%`);
console.log(`  ${out['screen (glass)'] > sur*1.25 ? 'the glass resists the night grade the plastic obeys — as C describes'
                                                  : '** the screen dims with its surround'}`);
await b.close();
