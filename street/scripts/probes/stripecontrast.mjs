// Do the mowing stripes READ? Measure the banding a player actually receives:
// sample horizontal scanlines across the grass in the rendered frame and report
// the light/dark amplitude. A mown field is a periodic signal; noise is not.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { setClock } from '../lib/clock.mjs';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(-20,-80,0,0.18,0)); await afterFrames(p,10); await p.waitForTimeout(2500);
await setClock(p,13);
const probe=async(n,x,z,tx,tz,pi,rows)=>{
 const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[x,z]);
 const yaw=Math.atan2(tx-x,-(tz-z));
 await p.evaluate(([x,z,y,g,pi])=>window.__ct.warp(x,z,y,g,pi),[x,z,yaw,gy,pi]);
 await afterFrames(p,4);
 const r=await p.evaluate((rows)=>{
  const c=document.querySelector('canvas'), t=document.createElement('canvas');
  t.width=1280; t.height=720; const g=t.getContext('2d'); g.drawImage(c,0,0,1280,720);
  const out=[];
  for(const y of rows){ const d=g.getImageData(0,y,1280,1).data; const L=[];
   for(let i=0;i<1280;i++) L.push(0.299*d[i*4]+0.587*d[i*4+1]+0.114*d[i*4+2]);
   // grass only: green-dominant pixels
   const green=[]; for(let i=0;i<1280;i++){const R=d[i*4],G=d[i*4+1],B=d[i*4+2]; if(G>R+6&&G>B+6) green.push(L[i]);}
   if(green.length<120){ out.push({y,n:green.length,skip:true}); continue; }
   const mean=green.reduce((a,v)=>a+v,0)/green.length;
   const s=[...green].sort((a,b)=>a-b);
   out.push({y, n:green.length, mean:+mean.toFixed(1),
     p10:+s[Math.floor(s.length*0.1)].toFixed(1), p90:+s[Math.floor(s.length*0.9)].toFixed(1),
     amp:+(s[Math.floor(s.length*0.9)]-s[Math.floor(s.length*0.1)]).toFixed(1)});}
  return out;},rows);
 console.log(`\n${n}:`);
 for(const o of r) console.log(o.skip?`   row ${o.y}: only ${o.n} grass px, skipped`
  :`   row ${o.y}: ${String(o.n).padStart(4)} grass px  mean ${String(o.mean).padStart(5)}  p10 ${String(o.p10).padStart(5)}  p90 ${String(o.p90).padStart(5)}  LIGHT/DARK AMPLITUDE ${o.amp}  (${(100*o.amp/o.mean).toFixed(1)}% of mean)`);
 return r;
};
await probe('standing on the field, looking across', -20,-80,-34,-84,-0.06,[430,470,520,570]);
await probe('the long view down the field',          -14,-88,-34,-88,-0.05,[420,460,510,560]);
await probe('looking down at your own feet',         -22,-82,-25,-84,-0.55,[400,480,560,640]);
await b.close();
