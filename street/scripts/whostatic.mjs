// walkers() returns 6, but the world has many more citizen billboards. If the
// extra ones stand near the junction they read as a pile-up without anyone
// being stuck - a different fault with a different fix.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(3000);
const r=await p.evaluate(()=>{
 const w=(window.__ct.walkers?window.__ct.walkers():[]).map(c=>({x:+(c.x??0).toFixed(2), z:+(c.z??0).toFixed(2)}));
 const figs=[];
 window.__ct.scene().traverse(o=>{
  if(!o.isMesh||!o.material?.map?.image||!o.geometry) return;
  const m=o.material.map, rep=m.repeat;
  if(Math.abs(rep.y)>0.9||Math.abs(rep.y)<1e-6) return;      // an atlas FRAME
  o.geometry.computeBoundingBox(); const bb=o.geometry.boundingBox;
  if(bb.max.y-bb.min.y<0.5) return;
  const e=o.matrixWorld.elements;
  figs.push({x:+e[12].toFixed(2), y:+e[13].toFixed(2), z:+e[14].toFixed(2)});
 });
 return {walkers:w, figs};});
const {walkers,figs}=r;
console.log(`walkers() reports ${walkers.length}   atlas-framed figures in the scene: ${figs.length}`);
const isWalker=(f)=>walkers.some(w=>Math.hypot(w.x-f.x,w.z-f.z)<1.2);
const stat=figs.filter(f=>!isWalker(f));
console.log(`figures that are NOT one of the walkers: ${stat.length}\n`);
// the junction is around (7.5, -95.5); the two crossings are both there
const JX=7.5, JZ=-95.5;
const near=stat.map(f=>({...f,d:+Math.hypot(f.x-JX,f.z-JZ).toFixed(1)})).sort((a,b)=>a.d-b.d);
console.log('static figures, nearest the junction first:');
for(const f of near.slice(0,14)) console.log(`   (${String(f.x).padStart(7)}, ${String(f.z).padStart(8)})  y ${f.y}   ${f.d} m from the junction`);
console.log(`\nwithin 12 m of the junction: ${near.filter(f=>f.d<12).length}   within 25 m: ${near.filter(f=>f.d<25).length}`);
await b.close();
