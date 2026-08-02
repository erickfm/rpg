// Three C rows in one sitting:
//   297  "i want the tv black"        -> the casing colour
//   299  "how do i stop watching"     -> an exit verb that is not just standing
//   301  "much more diversity"        -> scene.userData.tv.fmt, ten LAYOUTS not
//                                        twenty palettes of one layout
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1000,height:640}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1200);
await p.evaluate(()=>window.__ct.clock(23,10)); await afterFrames(p,6);
const prompt=()=>p.evaluate(()=>{const m=(document.body.innerText||'').match(/\[E\][^\n]*/);return m?m[0].trim():null;});

// 297 — the casing colour, measured off the set's own materials
const cas=await p.evaluate(()=>{
  const s=window.__ct.scene(); s.updateMatrixWorld(true); const out=[];
  s.traverse(o=>{ if(!o.isMesh||!o.geometry) return;
    if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const cx=(bb.min.x+bb.max.x)/2, cz=(bb.min.z+bb.max.z)/2, cy=(bb.min.y+bb.max.y)/2;
    if(Math.hypot(cx-197.6,cz+13.5)>3||cy<0.3||cy>1.6) return;
    const m=Array.isArray(o.material)?o.material[0]:o.material;
    if(!m||!m.color) return;
    const w=bb.max.x-bb.min.x, h=bb.max.y-bb.min.y, d=bb.max.z-bb.min.z;
    if(Math.max(w,h,d)>1.2||Math.max(w,h,d)<0.15) return;
    out.push({hex:m.color.getHexString(), lum:+((m.color.r+m.color.g+m.color.b)/3).toFixed(3),
              size:[+w.toFixed(2),+h.toFixed(2),+d.toFixed(2)]}); });
  return out; });
console.log(`\n297 — THE SET'S OWN MATERIALS near the TV (${cas.length}):`);
const seen=new Set();
for(const c of cas){ if(seen.has(c.hex)) continue; seen.add(c.hex);
  console.log(`   #${c.hex}  luminance ${c.lum}  ${c.size.join(' x ')}`); }
const dark=cas.filter(c=>c.lum<0.25).length;
console.log(`   materials darker than 0.25: ${dark} of ${cas.length}`);

// sit down
await p.evaluate(()=>window.__ct.warp(198.30,-16.30,0,window.__ct.pos()[3],0)); await afterFrames(p,5);
await p.mouse.click(450,280); await p.waitForTimeout(200);
await p.keyboard.press('e'); await afterFrames(p,10); await p.waitForTimeout(700);
console.log(`\n299 — seated. prompt: ${JSON.stringify(await prompt())}`);
const spots=await p.evaluate(()=>{ const q=window.__ct.pos();
  return window.__ct.spots().filter(s=>s.ok&&Math.hypot(s.x-q[0],s.z-q[2])<2.5)
    .map(s=>({l:s.label,d:+Math.hypot(s.x-q[0],s.z-q[2]).toFixed(2)})).sort((a,b)=>a.d-b.d); });
for(const s of spots) console.log(`     ${s.d} m  "${s.l}"`);

// 301 — formats
const fmts=new Map(); const segs=new Set();
for(let i=0;i<40;i++){
  const t=await p.evaluate(()=>{ const v=window.__ct.scene().userData.tv; return v&&{fmt:v.fmt,seg:v.seg}; });
  if(t){ if(t.fmt) fmts.set(t.fmt,(fmts.get(t.fmt)||0)+1); if(t.seg) segs.add(t.seg); }
  await p.waitForTimeout(2200);
}
console.log(`\n301 — over ${(40*2.2/60).toFixed(1)} minutes seated:`);
console.log(`   distinct FORMATS (layouts): ${fmts.size}  — C claims ten`);
console.log(`   ${[...fmts.keys()].join(', ')}`);
console.log(`   distinct segments (copy):   ${segs.size}`);
await b.close();
