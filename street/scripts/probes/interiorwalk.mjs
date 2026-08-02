// Walk all ten. Light level measured from the RENDERED FRAME, because every
// floor is textured with a white tint and material.color says nothing.
import { chromium } from 'playwright';
import { setClock } from '../lib/clock.mjs';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(0,-20,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(2000);
await setClock(p,13);
const dims=await p.evaluate(()=>window.__ct.roomDims());
const frameLum=()=>p.evaluate(()=>{
 const c=document.querySelector('canvas'); const t=document.createElement('canvas');
 t.width=160; t.height=90; const g=t.getContext('2d'); g.drawImage(c,0,0,160,90);
 const d=g.getImageData(0,0,160,90).data; let s=0,r=0,bl=0;
 for(let i=0;i<d.length;i+=4){ s+=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2]; r+=d[i]; bl+=d[i+2]; }
 const n=d.length/4; return {lum:+(s/n).toFixed(1), warmth:+((r-bl)/n).toFixed(1)};});
const rows=[];
for(const d of dims){
 const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[d.cx,d.cz]);
 // stand at the back-door end, look the length of the room
 const z=d.cz - d.d/2 + 1.3;
 await p.evaluate(([x,z,y,g])=>window.__ct.warp(x,z,Math.PI,g,-0.02),[d.cx,z,0,gy]);
 await afterFrames(p,4); await p.waitForTimeout(250);
 const L=await frameLum();
 await p.screenshot({path:`shots/int-${d.id}.png`});
 const pos=await p.evaluate(()=>window.__ct.pos());
 // VERIFY IT LANDED. A check that does not confirm where it stands reports on
 // wherever the camera actually is - which for the bodega was the street.
 const dx=Math.abs(pos[0]-d.cx), dz=Math.abs(pos[2]-z);
 const landed = dx<0.5 && dz<0.5;
 rows.push({id:d.id, landed, wantX:d.cx, gotX:+pos[0].toFixed(1), gotZ:+pos[2].toFixed(1), ...L});
 console.log(`  int-${d.id}.png  ${landed?'landed':'** MISSED'}  want x ${d.cx} z ${z.toFixed(1)}  got x ${pos[0].toFixed(1)} z ${pos[2].toFixed(1)}  lum ${L.lum}`);
}
const ok=rows.filter(o=>o.landed);
console.log(`\nlanded ${ok.length} of ${rows.length}`);
if(ok.length<rows.length){console.log('MISSED: '+rows.filter(o=>!o.landed).map(o=>`${o.id} (wanted x ${o.wantX}, got ${o.gotX})`).join(', '));}
const st=(k)=>{const s=ok.map(o=>o[k]).sort((a,b)=>a-b);return `min ${s[0]} med ${s[s.length>>1]} max ${s[s.length-1]}`;};
console.log(`\nframe luminance across the set: ${st('lum')}`);
console.log(`warmth (R-B)                 : ${st('warmth')}`);
console.log('\ndarkest to brightest:');
for(const o of ok.slice().sort((a,b)=>a.lum-b.lum)) console.log(`  ${o.id.padEnd(9)} lum ${String(o.lum).padStart(5)}  warmth ${String(o.warmth).padStart(5)}  eye above floor ${o.eye}`);
await b.close();
