// C: "the surround is a dull material and the screen is not, so the night grade
// dims the plastic while the glass stays bright." Measure both on one frame.
import { chromium } from 'playwright';
import fs from 'fs';
const b=await chromium.launch(); const dec=await b.newPage(); await dec.goto('about:blank');
const mean=async(f,x0,y0,x1,y1)=>dec.evaluate(async([b64,x0,y0,x1,y1])=>{
  const img=await createImageBitmap(await (await fetch('data:image/png;base64,'+b64)).blob());
  const cv=document.createElement('canvas'); cv.width=img.width; cv.height=img.height;
  const g=cv.getContext('2d'); g.drawImage(img,0,0);
  const d=g.getImageData(x0,y0,x1-x0,y1-y0).data;
  let s=0; for(let i=0;i<d.length;i+=4) s+=(d[i]+d[i+1]+d[i+2])/3;
  return +(s/(d.length/4)).toFixed(1); },[fs.readFileSync(f).toString('base64'),x0,y0,x1,y1]);
const F='shots/tv-bezel.png';
const screen=await mean(F,560,388,626,430);
const railTop=await mean(F,548,372,640,384);
const railBot=await mean(F,548,442,640,458);
const wall=await mean(F,760,380,860,440);
console.log(`\nat 23:10, on one frame:`);
console.log(`   the SCREEN (glass)        ${screen}`);
console.log(`   bezel rail, above         ${railTop}`);
console.log(`   bezel rail, below         ${railBot}`);
console.log(`   the room's wall, for scale ${wall}`);
console.log(`\n   screen / surround: ${(screen/((railTop+railBot)/2)).toFixed(2)}x`);
console.log(`   ${screen>((railTop+railBot)/2)*1.3 ? 'the glass stays bright while the plastic is dimmed — as C describes'
                                                   : '** the screen is not brighter than its surround'}`);
await b.close();
