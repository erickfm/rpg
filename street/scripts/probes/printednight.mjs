// Does printed signage go dark at night now? Same frame at 13:00 and 02:00,
// measuring the SIGN's pixels against the WALL beside it — a sign that darkens
// with its wall is lit by the world; one that holds its brightness is not.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
import fs from 'fs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1500);
// stand off the bodega frontage at (7.13, ...) looking at the printed sheets
const X=4.6, Z=10.57, YAW=Math.PI/2;
// decode in the chromium we already have, the way shotdiff.mjs does - no new deps
const mean=async(pg,file,x0,y0,x1,y1)=>pg.evaluate(async([b64,x0,y0,x1,y1])=>{
  const img=await createImageBitmap(await (await fetch('data:image/png;base64,'+b64)).blob());
  const cv=document.createElement('canvas'); cv.width=img.width; cv.height=img.height;
  const g=cv.getContext('2d'); g.drawImage(img,0,0);
  const d=g.getImageData(x0,y0,x1-x0,y1-y0).data;
  let s=0; for(let i=0;i<d.length;i+=4) s+=(d[i]+d[i+1]+d[i+2])/3;
  return s/(d.length/4);
},[fs.readFileSync(file).toString('base64'),x0,y0,x1,y1]);
const out={};
for(const [tag,h] of [['day',13],['night',2]]){
 await p.evaluate((h)=>window.__ct.clock(h,0),h); await afterFrames(p,8); await p.waitForTimeout(600);
 await p.evaluate(([x,z,y])=>window.__ct.warp(x,z,y,window.__ct.groundAt(x,z),0.02),[X,Z,YAW]);
 await afterFrames(p,5);
 const f=`shots/pn-${tag}.png`; await p.screenshot({path:f}); out[tag]=f;
 console.log(`  ${tag}: ${f}`);
}
// the sign sits centre-frame; the wall band is well above it
// SIGN is the red "BUY HERE PAY HERE" board; WALL must be plain brick. My
// first control box sat on the BUNTING, which is printed cloth and may carry
// the same flag - a control that shares the property under test is not one.
const SIGN=[420,330,880,390];        // the red board
const SIGN2=[380,440,920,490];       // the blue board
const WALL=[1150,20,1270,110];       // brick, right of frame
const WALL2=[20,20,140,110];         // brick, left of frame
const dec=await b.newPage();
await dec.goto('about:blank');
const g=async(box)=>[await mean(dec,out.day,...box), await mean(dec,out.night,...box)];
const [ds,ns]=await g(SIGN), [ds2,ns2]=await g(SIGN2);
const [dw,nw]=await g(WALL), [dw2,nw2]=await g(WALL2);
await b.close();
console.log(`\n            day     night   ratio`);
console.log(`  sign red board  ${ds.toFixed(1).padStart(6)} ${ns.toFixed(1).padStart(7)}  ${(ns/ds).toFixed(3)}`);
console.log(`  sign blue board ${ds2.toFixed(1).padStart(6)} ${ns2.toFixed(1).padStart(7)}  ${(ns2/ds2).toFixed(3)}`);
console.log(`  brick right     ${dw.toFixed(1).padStart(6)} ${nw.toFixed(1).padStart(7)}  ${(nw/dw).toFixed(3)}`);
console.log(`  brick left      ${dw2.toFixed(1).padStart(6)} ${nw2.toFixed(1).padStart(7)}  ${(nw2/dw2).toFixed(3)}`);
const rel=(((ns/ds)+(ns2/ds2))/2)/(((nw/dw)+(nw2/dw2))/2);
console.log(`\n  the sign darkens ${rel<1.25?'WITH':'LESS THAN'} its wall  (relative ${rel.toFixed(2)}; 1.00 = identical, >>1 = holding daylight)`);
