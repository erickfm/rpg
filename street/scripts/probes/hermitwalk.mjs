// The computed schedule, checked against the BUILT WORLD hour by hour.
// Arithmetic that agrees with the source proves the source, not the build.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
const HERMIT_GAP=6;
const raw=(h)=>{ const d=((h%24)+24)%24;
  const c=d>=12&&d<18?0.16:d>=8&&d<22?0.06:0.015;
  return ((((h+7)*2654435761)>>>0)%1000)<c*1000; };
const isIn=(h)=>{ if(!raw(h)) return false;
  for(let k=1;k<=HERMIT_GAP;k++) if(raw(h-k)) return false; return true; };
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:900,height:600}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1500);
await p.evaluate(()=>window.__ct.hermit(null));            // no forcing: read the schedule
// stand on HIS landing, outside 301/302
await p.evaluate(()=>window.__ct.warp(200.6,-16.5,Math.PI/2,5.4,0));
await afterFrames(p,6);
const here=await p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
console.log(`  standing at (${here[0]}, ${here[2]}) ground ${here[3]}\n`);
// A PERSON, not "anything tall near the door". My first version counted the
// 302 door leaf and its frame and reported him OUT at all 24 hours — and a
// detector that fires 100% of the time is indicting itself, not the world.
// A citizen here is an ATLAS-FRAMED billboard: a sub-rect of a sheet, visible,
// taller than 1.4 m.
const present=()=>p.evaluate(()=>{ const s=window.__ct.scene(); s.updateMatrixWorld(true); let n=0;
  s.traverse(o=>{ if(!o.isMesh||!o.geometry||!o.visible) return;
    const m=Array.isArray(o.material)?o.material[0]:o.material;
    const map=m&&m.map; if(!map||!map.repeat) return;
    const ry=Math.abs(map.repeat.y); if(ry>0.9||ry<1e-6) return;
    for(let q=o;q;q=q.parent) if(!q.visible) return;
    if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const cx=(bb.min.x+bb.max.x)/2, cz=(bb.min.z+bb.max.z)/2;
    if(bb.max.y-bb.min.y>1.4 && Math.hypot(cx-201.95,cz+16.5)<1.6) n++; });
  return n; });
let agree=0, dis=[], outHours=[];
for(let h=0;h<24;h++){
  await p.evaluate((h)=>window.__ct.clock(h,30),h); await afterFrames(p,6); await p.waitForTimeout(120);
  const n=await present(), want=isIn(h);
  if(want) outHours.push(h);
  if((n>0)===want) agree++; else dis.push(`h${h}: world ${n>0?'OUT':'in'}, schedule says ${want?'OUT':'in'}`);
  console.log(`   ${String(h).padStart(2)}:30  world ${n>0?'OUT ':'in  '}  schedule ${want?'OUT':'in '}  ${(n>0)===want?'':'  ** DISAGREE'}`);
}
console.log(`\n  hours he is out on day 0: ${outHours.length?outHours.join(', '):'none'}`);
console.log(`  agreement: ${agree} of 24 hours`);
for(const d of dis) console.log(`   ** ${d}`);
if(!outHours.length) console.log(`  NOTE: day 0 has no appearance, so this run only tests the "in" half.`);
await b.close();
process.exit(agree===24?0:1);
