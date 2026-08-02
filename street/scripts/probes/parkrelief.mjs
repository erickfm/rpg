// I sent this row back to OPEN with: range 0.365 m, median 0.140, 85.2% flat at
// 0.14, "felt underfoot, not seen". Re-measure the same way so the numbers are
// comparable to my own rejection.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
console.log(await p.evaluate(()=>{
 const H=[]; let n=0;
 for(let x=-40;x<=-9;x+=0.5) for(let z=-100;z<=-60;z+=0.5){
  const g=window.__ct.groundAt(x,z); if(g>-1&&g<5){H.push(+g.toFixed(3)); n++;} }
 H.sort((a,b)=>a-b);
 const q=(f)=>H[Math.floor(H.length*f)];
 const mode=H[Math.floor(H.length/2)];
 const flat=H.filter(v=>Math.abs(v-mode)<0.005).length;
 let s=`park samples: ${n}\n`;
 s+=`  range ${H[0]} … ${H[H.length-1]}  = ${(H[H.length-1]-H[0]).toFixed(3)} m   (was 0.365)\n`;
 s+=`  median ${mode}   p10 ${q(0.10)}  p25 ${q(0.25)}  p75 ${q(0.75)}  p90 ${q(0.90)}   (p90 was 0.219)\n`;
 s+=`  flat at the median: ${(100*flat/n).toFixed(1)}%   (was 85.2%)\n`;
 // a crossing profile, as before
 const line=[]; for(let x=-36;x<=-10;x+=2) line.push(+window.__ct.groundAt(x,-83).toFixed(2));
 s+=`  crossing z -83, x -36→-10: ${line.join(' → ')}\n`;
 return s;}));
await b.close();
