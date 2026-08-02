// "i want to be able to watch tv. and i sit on the bed and literally watch"
// C's STATION: stand in 301 at (198.30, -16.30), press E, camera settles at
// (197.90, -15.58), prompt becomes [E] stand up. Then the content must not be
// a loop - segments should cut and not immediately repeat.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
import fs from 'fs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1000,height:640}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1200);
const pos=()=>p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
const prompt=()=>p.evaluate(()=>{const m=(document.body.innerText||'').match(/\[E\][^\n]*/);return m?m[0].trim():null;});
await p.evaluate(()=>window.__ct.warp(198.30,-16.30,0,window.__ct.pos()[3],0));
await afterFrames(p,6); await p.waitForTimeout(400);
const stand=await pos(); const p0=await prompt();
console.log(`\nat the station (${stand[0]}, ${stand[2]})  prompt ${JSON.stringify(p0)}`);
await p.keyboard.press('e'); await afterFrames(p,10); await p.waitForTimeout(700);
const sat=await pos(); const p1=await prompt();
console.log(`after E:      (${sat[0]}, ${sat[2]})  prompt ${JSON.stringify(p1)}`);
console.log(`  C said the camera settles at (197.90, -15.58) — ${Math.hypot(sat[0]-197.90,sat[2]+15.58)<0.35?'it does':'** it does not'}`);
console.log(`  seated prompt is stand-up — ${/stand up/i.test(p1||'')?'yes':'** no'}`);
// the screen, sampled over time
await p.screenshot({path:'shots/tv-0.png'});
const dec=await b.newPage(); await dec.goto('about:blank');
const sig=async(f)=>dec.evaluate(async(b64)=>{
  const img=await createImageBitmap(await (await fetch('data:image/png;base64,'+b64)).blob());
  const cv=document.createElement('canvas'); cv.width=img.width; cv.height=img.height;
  const g=cv.getContext('2d'); g.drawImage(img,0,0);
  // THE SCREEN, not the wall above it. My first box was x 0.34-0.66 / y 0.30-0.58
  // which is the bedroom wall and the poster; the set sits low and right. Reading
  // a constant grey off plaster and calling the television static is the alley
  // lamp mistake again.
  const d=g.getImageData(Math.floor(cv.width*0.555),Math.floor(cv.height*0.605),
                          Math.floor(cv.width*0.080),Math.floor(cv.height*0.095)).data;
  let r=0,gg=0,bb=0; for(let i=0;i<d.length;i+=4){ r+=d[i]; gg+=d[i+1]; bb+=d[i+2]; }
  const n=d.length/4; return [Math.round(r/n),Math.round(gg/n),Math.round(bb/n)];
},fs.readFileSync(f).toString('base64'));
const seq=[];
for(let i=0;i<14;i++){
  await p.waitForTimeout(2200);
  const f=`shots/tv-s${i}.png`; await p.screenshot({path:f});
  seq.push({t:(i+1)*2.2, rgb:await sig(f)});
}
console.log(`\nthe screen sampled every 2.2 s while seated:`);
let cuts=0, prev=null;
for(const s of seq){
  const d=prev? Math.max(...s.rgb.map((v,i)=>Math.abs(v-prev[i]))) : 0;
  if(prev&&d>12) cuts++;
  console.log(`   t+${String(s.t.toFixed(1)).padStart(5)}s  rgb ${s.rgb.join(',').padEnd(14)} ${prev? (d>12?`CUT (max channel delta ${d})`:`same (${d})`) : ''}`);
  prev=s.rgb;
}
console.log(`\n  cuts seen in ${(seq.length*2.2).toFixed(0)} s: ${cuts}`);
console.log(`  ${cuts>=2 ? 'the screen changes — it is not one still image' : '** the screen did not change'}`);
await p.keyboard.press('e'); await afterFrames(p,10); await p.waitForTimeout(600);
const up=await pos();
console.log(`\nstood up: (${up[0]}, ${up[2]})  ${Math.hypot(up[0]-stand[0],up[2]-stand[2])<1.2?'back at the approach':'** somewhere else'}`);
await b.close();
