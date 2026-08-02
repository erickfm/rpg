// material.color is a white TINT on textured surfaces, so it cannot compare
// palettes. Compare the RENDERED frames instead - that is what "the interior
// doesn't match the exterior" is a claim about anyway.
import { chromium } from 'playwright';
import { setClock } from '../lib/clock.mjs';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(30,-104,0,0,0)); await afterFrames(p,10); await p.waitForTimeout(2000);
await setClock(p,13);
const pal=()=>p.evaluate(()=>{
 const c=document.querySelector('canvas'), t=document.createElement('canvas');
 t.width=256; t.height=144; const g=t.getContext('2d'); g.drawImage(c,0,0,256,144);
 const d=g.getImageData(0,0,256,120).data, bin={};
 for(let i=0;i<d.length;i+=4){ const q=(v)=>Math.round(v/24)*24;
  const k=`${q(d[i])},${q(d[i+1])},${q(d[i+2])}`; bin[k]=(bin[k]||0)+1; }
 return Object.entries(bin).sort((a,b)=>b[1]-a[1]).slice(0,8)
   .map(([k,n])=>({rgb:k.split(',').map(Number), pct:+(100*n/(256*120)).toFixed(1)}));});
const hexs=(a)=>'#'+a.map(v=>Math.min(255,v).toString(16).padStart(2,'0')).join('');
const dims=await p.evaluate(()=>window.__ct.roomDims().find(q=>q.id==='hotel'));
// exterior: the hotel front from the side street
await p.evaluate(()=>window.__ct.warp(39.5,-102.5,Math.atan2(0,-(-96.0+102.5)),0,0.10));
await afterFrames(p,5); await p.screenshot({path:'shots/hp-ext.png'});
const ext=await pal();
// interior
const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[dims.cx,dims.cz]);
await p.evaluate(([x,z,g])=>window.__ct.warp(x,z,Math.PI,g,-0.02),[dims.cx,dims.cz-dims.d/2+1.6,gy]);
await afterFrames(p,5); await p.screenshot({path:'shots/hp-int.png'});
const int=await pal();
console.log('hotel EXTERIOR, dominant colours:');
for(const q of ext) console.log(`   ${hexs(q.rgb)}  ${q.pct}%`);
console.log('hotel INTERIOR, dominant colours:');
for(const q of int) console.log(`   ${hexs(q.rgb)}  ${q.pct}%`);
const warm=(a)=>a.filter(q=>q.rgb[0]>q.rgb[2]+30).reduce((s,q)=>s+q.pct,0);
const red =(a)=>a.filter(q=>q.rgb[0]>90&&q.rgb[0]>q.rgb[1]*1.6&&q.rgb[0]>q.rgb[2]*1.6).reduce((s,q)=>s+q.pct,0);
console.log(`\nwarm (R>B+30):   exterior ${warm(ext).toFixed(1)}%   interior ${warm(int).toFixed(1)}%`);
console.log(`strongly RED:    exterior ${red(ext).toFixed(1)}%   interior ${red(int).toFixed(1)}%`);
await b.close();
