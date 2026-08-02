// material.color is a white TINT on textured surfaces, so "luminance > 0.75"
// counts every textured material in the world. Count the FLAGS instead.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
console.log(await p.evaluate(()=>{
 const cnt={selfLitObj:0, printedObj:0, selfLitMat:0, printedMat:0}, byMod={};
 window.__ct.scene().traverse(o=>{
  const e=o.matrixWorld.elements; if(e[12]>200) return;
  const u=o.userData||{};
  if(u.selfLit){cnt.selfLitObj++; const k=u.mod||'?'; byMod[k]=(byMod[k]||0)+1;}
  if(u.printed) cnt.printedObj++;
  for(const m of (Array.isArray(o.material)?o.material:[o.material])){
   if(!m) continue;
   if(m.userData?.selfLit) cnt.selfLitMat++;
   if(m.userData?.printed) cnt.printedMat++; }});
 return `objects with userData.selfLit : ${cnt.selfLitObj}   by module ${JSON.stringify(byMod)}\n`
      + `objects with userData.printed : ${cnt.printedObj}\n`
      + `MATERIALS with selfLit        : ${cnt.selfLitMat}\n`
      + `MATERIALS with printed        : ${cnt.printedMat}\n`;}));
await b.close();
