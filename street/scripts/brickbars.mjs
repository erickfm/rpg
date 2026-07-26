// "why so many vertical stripes on the brick?" C: the cause was four 2px soot
// bars running the FULL tile height, which tiling repeats into ~7 stripes.
// Claim: 0 full-height bars now, 2 columns at 3 below median (both perp joints).
// Read the texture and count full-height dark columns directly.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
console.log(await p.evaluate(()=>{
 // brick textures on the light-well faces near room 301
 const seen=new Map();
 window.__ct.scene().traverse(o=>{ if(!o.isMesh||!o.material?.map?.image) return;
  const e=o.matrixWorld.elements;
  if(e[12]<198||e[12]>206||e[14]<-14||e[14]>-7) return;
  const im=o.material.map.image; if(!im.width) return;
  if(!seen.has(im)) seen.set(im, o.material.map);
 });
 if(!seen.size) return 'no textured mesh found on the light-well faces';
 let s=`textures on the light-well faces: ${seen.size}\n`;
 for(const [img,map] of seen){
  const W=img.width,H=img.height;
  const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const g=cv.getContext('2d',{willReadFrequently:true}); g.drawImage(img,0,0);
  const d=g.getImageData(0,0,W,H).data;
  const col=[], full=[];
  for(let x=0;x<W;x++){ let sum=0,n=0,darkRows=0;
   for(let y=0;y<H;y++){ const i=(y*W+x)*4; const L=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2]; sum+=L; n++; }
   col.push(sum/n); }
  const med=[...col].sort((a,b)=>a-b)[Math.floor(W/2)];
  // a FULL-HEIGHT bar: dark in nearly every row of the column
  for(let x=0;x<W;x++){ let darkRows=0;
   for(let y=0;y<H;y++){ const i=(y*W+x)*4; const L=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
    if(L < med-6) darkRows++; }
   if(darkRows > H*0.9) full.push({x, below:+(med-col[x]).toFixed(1)});
  }
  const belowMed=col.map((v,x)=>({x,below:+(med-v).toFixed(1)})).filter(q=>q.below>=2.5);
  s+=`  ${W}x${H}px  median column ${med.toFixed(1)}\n`;
  s+=`     FULL-HEIGHT dark bars (dark in >90% of rows): ${full.length}${full.length?' at x '+full.map(q=>q.x).join(','):''}   (C: 0)\n`;
  s+=`     columns 2.5+ below the median: ${belowMed.length}${belowMed.length?' — '+belowMed.slice(0,6).map(q=>`x${q.x} (−${q.below})`).join(' '):''}   (C: 2 at −3, both perp joints)\n`;
 }
 return s;}));
await b.close();
