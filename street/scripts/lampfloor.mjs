// B quotes 0.5278 under a head against 0.0450 mid-block. Those are the world's
// own per-surface night values, so read THOSE rather than frame pixels - my
// downward-frame sampling mixes kerb, walk and road and is not comparable.
import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(-6.2,-40,0,0.14,0));
await p.waitForTimeout(2000);
await setClock(p,22);
await p.waitForTimeout(1500);
console.log(await p.evaluate(()=>{
 const lum=(c)=>0.299*c.r+0.587*c.g+0.114*c.b;
 const rows=[];
 window.__ct.scene().traverse(o=>{ if(!o.isMesh||!o.geometry)return;
  const e=o.matrixWorld.elements; const x=e[12], z=e[14];
  if(x<-8||x>-4||z<-62||z>-20) return;
  o.geometry.computeBoundingBox(); const bb=o.geometry.boundingBox;
  if((bb.max.y-bb.min.y)>0.4) return;                  // ground sheets only
  const m=Array.isArray(o.material)?o.material[0]:o.material; if(!m?.color) return;
  rows.push({z:+z.toFixed(1), L:+lum(m.color).toFixed(4), nf:o.userData?.nightFactor});
 });
 rows.sort((a,b)=>b.z-a.z);
 if(!rows.length) return 'no ground sheet carried a readable colour in that band';
 let s=`ground sheets on the west walk, 22:00: ${rows.length}\n`;
 const Ls=rows.map(r=>r.L), mx=Math.max(...Ls), mn=Math.min(...Ls);
 for(const r of rows.slice(0,26)){ const bar='#'.repeat(Math.round(30*(r.L-mn)/Math.max(1e-9,mx-mn)));
  s+=`   z ${String(r.z).padStart(6)}  L ${String(r.L).padStart(7)}  nf ${r.nf ?? '-'}  ${bar}\n`;}
 s+=`\n   brightest ${mx}  darkest ${mn}  ratio ${(mx/Math.max(mn,1e-4)).toFixed(1)}x   (B states 11.7x on the main street)\n`;
 return s;}));
await b.close();
