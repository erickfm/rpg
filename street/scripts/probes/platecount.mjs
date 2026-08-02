// Independent of C's assertion: how many materials on each door leaf carry the
// number plate? C reports 302 previously had it on BOTH faces, so the count per
// leaf is the thing to check - one plate, on one face.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{
  const s=window.__ct.scene(); s.updateMatrixWorld(true); const out=[];
  s.traverse(o=>{ if(!o.isMesh) return;
    const ms=Array.isArray(o.material)?o.material:[o.material];
    const idx=[]; ms.forEach((m,i)=>{ if(m&&m.userData&&m.userData.plate) idx.push(i); });
    if(!idx.length) return;
    const e=o.matrixWorld.elements;
    out.push({plates:idx, of:ms.length, x:+e[12].toFixed(2), z:+e[14].toFixed(2)}); });
  return out; });
console.log(`\nmeshes carrying a numbered plate: ${r.length}`);
let bad=0;
for(const d of r){
  const ok=d.plates.length===1;
  if(!ok) bad++;
  console.log(`   at (${d.x}, ${d.z})  plate on material ${d.plates.join(' and ')} of ${d.of}   ${ok?'one face':'** '+d.plates.length+' FACES'}`);
}
console.log(`\n  ${r.length? (bad? `** ${bad} leaves carry the number on more than one face` : 'every leaf carries its number on exactly one face') : 'CANNOT ANSWER — nothing is stamped userData.plate'}`);
if(!r.length) process.exit(3);
await b.close();
