// Does the alley lamp CAST, or is it a glow painted on a wall? A cast light
// makes a POOL - a hump in the brightness profile centred on the fitting. A
// painted glow is bright only where the fitting is drawn.
import { chromium } from 'playwright';
import fs from 'fs';
const b=await chromium.launch(); const dec=await b.newPage(); await dec.goto('about:blank');
const strip=async(file,y0,y1,x0,x1,n)=>dec.evaluate(async([b64,y0,y1,x0,x1,n])=>{
  const img=await createImageBitmap(await (await fetch('data:image/png;base64,'+b64)).blob());
  const cv=document.createElement('canvas'); cv.width=img.width; cv.height=img.height;
  const g=cv.getContext('2d'); g.drawImage(img,0,0);
  const out=[]; const w=Math.floor((x1-x0)/n);
  for(let i=0;i<n;i++){ const d=g.getImageData(x0+i*w,y0,w,y1-y0).data;
    let s=0; for(let k=0;k<d.length;k+=4) s+=(d[k]+d[k+1]+d[k+2])/3;
    out.push(+(s/(d.length/4)).toFixed(1)); }
  return out; },[fs.readFileSync(file).toString('base64'),y0,y1,x0,x1,n]);
console.log(`\nan-d-wall.png — brightness across the LEFT wall at lamp height (y 300..350):`);
const at=await strip('shots/an-d-wall.png',300,350,300,640,28);
console.log('   '+at.map(v=>String(v).padStart(6)).join(''));
console.log(`\nthe same wall well ABOVE the lamp (y 120..170), where no pool should reach:`);
const above=await strip('shots/an-d-wall.png',120,170,300,640,28);
console.log('   '+above.map(v=>String(v).padStart(6)).join(''));
const peak=Math.max(...at), floor=Math.min(...at);
const peakA=Math.max(...above);
console.log(`\n  at lamp height: min ${floor}  peak ${peak}  contrast ${(peak/Math.max(floor,0.1)).toFixed(1)}x`);
console.log(`  above it:       peak ${peakA}`);
// SHAPE, not peak height. A cast pool falls off over a span; a painted glow is
// bright only in the bins where the fitting is drawn. Count how many bins sit
// meaningfully above the local baseline.
const base=[...at].sort((a,b)=>a-b)[Math.floor(at.length*0.4)];
const lit=at.filter(v=>v>base*1.25).length;
console.log(`  baseline ${base.toFixed(1)}, bins above 1.25x baseline: ${lit} of ${at.length}`);
console.log(`  ${lit>=4 ? 'a spread of raised bins — the light falls off over a span, i.e. a POOL'
                        : '** a narrow spike: bright only where the fitting is drawn, no falloff — a PAINTED glow'}`);
await b.close();
