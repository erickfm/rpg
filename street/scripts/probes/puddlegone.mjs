// DESK RULING: standing puddles removed, everything else in the weather system
// kept. Verify BOTH - the water is gone AND the wet look still outlasts the rain,
// because removing a feature is only safe if what it was entangled with survives.
import { chromium } from 'playwright';
import { setClock } from '../lib/clock.mjs';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(0,-50,0,0,0));
await p.waitForTimeout(2000);
// 1. is there any standing water left?
const w=await p.evaluate(()=>{
 const keys=new Set(), hits=[];
 window.__ct.scene().traverse(o=>{
  for(const k of Object.keys(o.userData||{})) if(/wet|water|puddle|rain/i.test(k)) keys.add(k);
  const u=o.userData||{};
  if(u.puddle||u.standingWater) hits.push({x:+(o.matrixWorld.elements[12]).toFixed(1)});
 });
 return {keys:[...keys], puddleTagged:hits.length};});
console.log(`water-related userData keys in the world: ${w.keys.join(', ')||'(none)'}`);
console.log(`objects tagged as a puddle / standing water: ${w.puddleTagged}`);
// 2. does the wet look outlast the rain?
console.log('\nroad tone through a storm and after it (mean luminance of the road material):');
const road=()=>p.evaluate(()=>{ let best=null,bd=1e9;
 window.__ct.scene().traverse(o=>{ if(!o.isMesh||!o.geometry)return;
  const e=o.matrixWorld.elements; o.geometry.computeBoundingBox(); const bb=o.geometry.boundingBox;
  if((bb.max.y-bb.min.y)>0.3) return;
  const d=Math.hypot(e[12]-0, e[14]+50); if(Math.abs(e[13])>0.05) return;
  if(d<bd){bd=d; const m=Array.isArray(o.material)?o.material[0]:o.material;
   best=m?.color?+(0.299*m.color.r+0.587*m.color.g+0.114*m.color.b).toFixed(4):null;} });
 return best;});
await setClock(p,14); await p.waitForTimeout(3000);
console.log(`  during rain (14:00), settled:      ${await road()}`);
await p.waitForTimeout(9000);
console.log(`  still raining, +9 s:               ${await road()}`);
await setClock(p,16);                                  // a dry hour
for(const t of [1000,4000,8000,13000]){ await p.waitForTimeout(t===1000?1000:3000+ (t===13000?2000:0));
 console.log(`  after the rain stops, ~${String(Math.round(t/1000)).padStart(2)} s:      ${await road()}`);}
await b.close();
