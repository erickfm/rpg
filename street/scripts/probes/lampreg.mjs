// Row 259: B published scene.userData.addLamp(x,z) so any module can declare a
// light, and left ONE LINE OUTSTANDING IN D'S FILE - so the question is whether
// D's alley lamp is actually REGISTERED, or still a glow painted on a wall.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1200);
const r=await p.evaluate(()=>{
  const s=window.__ct.scene(); const ud=s.userData||{};
  const keys=Object.keys(ud);
  const out={keys, addLamp:typeof ud.addLamp};
  for(const k of keys){ const v=ud[k];
    if(Array.isArray(v)) out[k]=`array[${v.length}]`+(v.length&&typeof v[0]==='object'?' '+JSON.stringify(v.slice(0,6)):'');
    else if(typeof v!=='function') out[k]=JSON.stringify(v)?.slice(0,160); }
  return out; });
console.log(`\nscene.userData keys: ${r.keys.join(', ')}`);
console.log(`addLamp: ${r.addLamp}`);
for(const k of r.keys) if(r[k]&&typeof r[k]==='string'&&/array/.test(r[k])) console.log(`  ${k}: ${r[k]}`);
// any registered lamp in D's alley?
const near=await p.evaluate(()=>{
  const ud=window.__ct.scene().userData||{};
  const lists=Object.entries(ud).filter(([,v])=>Array.isArray(v));
  const hits=[];
  for(const [k,v] of lists) for(const e of v){
    const x=e&&(e.x??e[0]), z=e&&(e.z??e[2]??e[1]);
    if(typeof x!=='number'||typeof z!=='number') continue;
    if(Math.abs(x-12)<6&&z>-62&&z<-46) hits.push(`${k}: (${x.toFixed(2)}, ${z.toFixed(2)})`); }
  return hits; });
console.log(`\nregistered entries inside D's alley (x 6..18, z -62..-46): ${near.length}`);
for(const h of near) console.log(`   ${h}`);
await b.close();
