import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(0,-40,0,0.14,0)); await p.waitForTimeout(2000);
await setClock(p,22); await p.waitForTimeout(2500);
console.log(await p.evaluate(()=>{
 const lum=(c)=>0.299*c.r+0.587*c.g+0.114*c.b;
 const byMod={}; let bright=0, tot=0; const list=[];
 window.__ct.scene().traverse(o=>{ if(!o.isMesh)return;
  const e=o.matrixWorld.elements; if(e[12]>200) return;          // street world only
  const u=o.userData||{};
  for(const m of (Array.isArray(o.material)?o.material:[o.material])){
   if(!m?.color) continue; tot++;
   const L=lum(m.color);
   if(L>0.75){ bright++; const k=u.mod||'?'; byMod[k]=(byMod[k]||0)+1;
    if(list.length<10) list.push({mod:k, x:+e[12].toFixed(1), z:+e[14].toFixed(1), L:+L.toFixed(2), printed:!!u.printed, selfLit:!!u.selfLit}); }
  }});
 let s=`materials in the street world at 22:00: ${tot}\n`;
 s+=`still at full brightness after dark (lum > 0.75): ${bright}\n`;
 s+=`by module: ${JSON.stringify(byMod)}\n`;
 for(const q of list) s+=`   ${q.mod} at (${q.x}, ${q.z})  lum ${q.L}  printed=${q.printed} selfLit=${q.selfLit}\n`;
 return s;}));
await b.close();
