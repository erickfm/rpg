// WHERE do the stripes read? Stand at points across the park, look down at the
// grass as a player does, and measure the light/dark amplitude at each.
import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto('http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(-20,-80,0,0.18,0)); await afterFrames(p,10); await p.waitForTimeout(2500);
await setClock(p,13);
const amp=async()=>p.evaluate(()=>{
 const c=document.querySelector('canvas'), t=document.createElement('canvas');
 t.width=1280;t.height=720; const g=t.getContext('2d'); g.drawImage(c,0,0,1280,720);
 const vals=[]; for(const y of [420,470,520,570,620]){ const d=g.getImageData(0,y,1280,1).data;
  for(let i=0;i<1280;i++){const R=d[i*4],G=d[i*4+1],B=d[i*4+2];
   if(G>R+6&&G>B+6) vals.push(0.299*R+0.587*G+0.114*B);}}
 if(vals.length<200) return {n:vals.length,amp:null};
 const s=vals.sort((a,b)=>a-b), mean=s.reduce((a,v)=>a+v,0)/s.length;
 return {n:s.length, mean:+mean.toFixed(1), amp:+(s[Math.floor(s.length*0.9)]-s[Math.floor(s.length*0.1)]).toFixed(1),
   pct:+(100*(s[Math.floor(s.length*0.9)]-s[Math.floor(s.length*0.1)])/mean).toFixed(1)};});
const PTS=[
 ['entrance lawn',   -11,-74],['near the gate',   -13,-70],
 ['mid-west',        -18,-76],['field centre',    -24,-84],
 ['field south',     -24,-92],['field north',     -24,-76],
 ['east strip',      -12,-88],['far west',        -34,-84],
];
console.log(`pitch ${process.env.PITCH||-0.50} (${Number(process.env.PITCH||-0.5)<-0.3?'looking DOWN at your feet':'looking AHEAD across the lawn'})`);
console.log('where                 amplitude   % of mean   grass px');
for(const [n,x,z] of PTS){
 const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[x,z]);
 await p.evaluate(([x,z,g,pi])=>window.__ct.warp(x,z,Math.PI,g,pi),[x,z,gy,Number(process.env.PITCH||-0.50)]);
 await afterFrames(p,4);
 const got=await p.evaluate(()=>window.__ct.pos());
 const ok=Math.hypot(got[0]-x,got[2]-z)<0.8;
 const a=await amp();
 console.log(`${n.padEnd(18)} ${String(a.amp??'—').padStart(9)} ${String(a.pct??'—').padStart(11)}% ${String(a.n).padStart(9)}  ${ok?'':'** MISSED'}`);
}
await b.close();
