// "I WANT TO BE ABLE TO WALK UP THOSE STAIRS" - F points at the library stair.
// A stair is only real if the WALKABLE ground rises, so sample groundAt across
// the room and look for a climb, then walk it.
import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2000); await setClock(p,13);
const d=await p.evaluate(()=>window.__ct.roomDims().find(q=>q.id==='library'));
console.log(`library room ${d.w} x ${d.d} at (${d.cx}, ${d.cz})`);
const grid=await p.evaluate(([cx,cz,w,dd])=>{
 const rows=[];
 for(let z=cz-dd/2+0.5; z<=cz+dd/2-0.5; z+=1.0){
  const line=[];
  for(let x=cx-w/2+0.5; x<=cx+w/2-0.5; x+=1.0) line.push(+window.__ct.groundAt(x,z).toFixed(2));
  rows.push({z:+z.toFixed(1), line});
 }
 return rows;},[d.cx,d.cz,d.w,d.d]);
let hi=-9, hiAt=null, lo=9;
for(const r of grid){ for(let i=0;i<r.line.length;i++){ const v=r.line[i];
  if(v>hi){hi=v; hiAt={x:+(d.cx-d.w/2+0.5+i).toFixed(1), z:r.z};} if(v<lo)lo=v; }}
console.log(`floor heights across the room: ${lo} … ${hi}`);
if(hi-lo>0.4){
 console.log(`  -> a climb of ${(hi-lo).toFixed(2)} m, highest at (${hiAt.x}, ${hiAt.z})`);
 for(const r of grid){ const s=r.line.map(v=>v>lo+0.35?'#':(v>lo+0.1?'+':'.')).join('');
  if(s.includes('#')||s.includes('+')) console.log(`     z ${String(r.z).padStart(6)}  ${s}`); }
} else console.log('  -> NO climb: the room floor is flat, so there is nothing to walk up');
// stand at the foot and look up it
if(hiAt){
 const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[hiAt.x, hiAt.z-3.5]);
 await p.evaluate(([x,z,y,g])=>window.__ct.warp(x,z,y,g,0.18),[hiAt.x, hiAt.z-3.5, Math.atan2(0,-(hiAt.z-(hiAt.z-3.5))), gy]);
 await afterFrames(p,4); await p.screenshot({path:'shots/lib-stair.png'});
 console.log('  shots/lib-stair.png');
}
await b.close();
