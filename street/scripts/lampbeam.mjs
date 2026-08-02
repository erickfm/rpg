// "make street light a bit more broad ... make the unilluminated stuff darker ...
//  i want to be able to see stars sometimes"
// Measure the beam as the player receives it: ground brightness looking down,
// stepped along the street, so pools and the gaps between them both show.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(-6.2,-40,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(2000);
await setClock(p,22);
const lum=()=>p.evaluate(()=>{const c=document.querySelector('canvas'),t=document.createElement('canvas');
 t.width=120;t.height=68;const g=t.getContext('2d');g.drawImage(c,0,0,120,68);
 const d=g.getImageData(20,20,80,30).data; let s=0,n=0;
 for(let i=0;i<d.length;i+=4){s+=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];n++;}
 return +(s/n).toFixed(2);});
console.log('ground brightness looking down, west walk, 22:00');
const prof=[];
for(let z=-24;z>=-58;z-=1.0){
 await p.evaluate(([z])=>window.__ct.warp(-6.2,z,0,0.14,-1.35),[z]);
 await afterFrames(p,3);
 const v=await lum(); prof.push({z:+z.toFixed(0),v});
}
const vs=prof.map(o=>o.v), mx=Math.max(...vs), mn=Math.min(...vs);
for(const o of prof){ const bar='#'.repeat(Math.round(28*(o.v-mn)/Math.max(1e-6,mx-mn)));
 console.log(`  z ${String(o.z).padStart(4)}  ${String(o.v).padStart(6)}  ${bar}`);}
console.log(`\nbrightest ${mx}  darkest ${mn}  ratio ${(mx/Math.max(mn,0.01)).toFixed(1)}x`);
// pool width: contiguous runs above the midpoint
const mid=(mx+mn)/2; let runs=[],cur=null;
for(const o of prof){ if(o.v>=mid){ if(!cur)cur={a:o.z,b:o.z}; else cur.b=o.z; } else { if(cur){runs.push(cur);cur=null;} } }
if(cur)runs.push(cur);
console.log(`lit pools (above the midpoint): ${runs.length}`);
for(const r of runs) console.log(`   z ${r.a} .. ${r.b}  = ${Math.abs(r.b-r.a)+1} m across`);
// stars: look up
await p.evaluate(()=>window.__ct.warp(-6.2,-40,0,0.14,1.35));
await afterFrames(p,4); await p.screenshot({path:'shots/lm-sky.png'});
const sky=await p.evaluate(()=>{const c=document.querySelector('canvas'),t=document.createElement('canvas');
 t.width=320;t.height=180;const g=t.getContext('2d');g.drawImage(c,0,0,320,180);
 const d=g.getImageData(0,0,320,120).data; let bright=0,n=0,sum=0;
 for(let i=0;i<d.length;i+=4){const L=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2]; sum+=L; n++; if(L>90)bright++;}
 return {mean:+(sum/n).toFixed(1), brightPx:bright, n};});
console.log(`\nsky looking up at 22:00: mean ${sky.mean}, pixels brighter than 90: ${sky.brightPx} of ${sky.n}  ${sky.brightPx>20?'-> STARS present':'-> no star field detected'}`);
await b.close();
