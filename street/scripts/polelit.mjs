// The sign lit, the printed boards not — measured, not just seen.
import { chromium } from 'playwright';
import fs from 'fs';
const b=await chromium.launch(); const dec=await b.newPage(); await dec.goto('about:blank');
const mean=async(file,x0,y0,x1,y1)=>dec.evaluate(async([b64,x0,y0,x1,y1])=>{
  const img=await createImageBitmap(await (await fetch('data:image/png;base64,'+b64)).blob());
  const cv=document.createElement('canvas'); cv.width=img.width; cv.height=img.height;
  const g=cv.getContext('2d'); g.drawImage(img,0,0);
  const d=g.getImageData(x0,y0,x1-x0,y1-y0).data;
  let s=0; for(let i=0;i<d.length;i+=4) s+=(d[i]+d[i+1]+d[i+2])/3;
  return +(s/(d.length/4)).toFixed(1);
},[fs.readFileSync(file).toString('base64'),x0,y0,x1,y1]);
const R={ 'pole sign panel':[915,80,1075,175],
          'printed boards (lot fence)':[600,398,730,437],
          'printed boards (right)':[1060,400,1180,437],
          'night sky':[400,60,560,140] };
console.log(`\n region                        day    night   night/day`);
for(const [k,v] of Object.entries(R)){
  const d=await mean('shots/pole-day.png',...v), n=await mean('shots/pole-night.png',...v);
  console.log(`  ${k.padEnd(28)} ${String(d).padStart(5)} ${String(n).padStart(7)}   ${(n/d).toFixed(3)}`);
}
await b.close();
