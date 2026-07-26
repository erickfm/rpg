// "parked cars leaving a gap the player fits into but cannot leave"
// H: 411 colliders, 215 pairs within 1.6 m, 64 gaps in the 0.40-0.95 trap band,
// NONE involving a kerbside parked car. Check that, and check WHERE they are -
// a gap off the map cannot trap anybody.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{
 const c=window.__ct.colliders();
 const gapOf=(a,b)=>{ // separation between two AABBs, per axis, taking the larger
  const dx=Math.max(a.minX-b.maxX, b.minX-a.maxX);
  const dz=Math.max(a.minZ-b.maxZ, b.minZ-a.maxZ);
  if(dx>0&&dz>0) return Math.hypot(dx,dz);
  return Math.max(dx,dz); };
 const overlapsX=(a,b)=>Math.min(a.maxX,b.maxX)>Math.max(a.minX,b.minX);
 const overlapsZ=(a,b)=>Math.min(a.maxZ,b.maxZ)>Math.max(a.minZ,b.minZ);
 const near=[], band=[];
 for(let i=0;i<c.length;i++) for(let j=i+1;j<c.length;j++){
  const g=gapOf(c[i],c[j]); if(!(g>0&&g<1.6)) continue;
  if(!overlapsX(c[i],c[j]) && !overlapsZ(c[i],c[j])) continue;   // must face each other
  near.push(g);
  if(g>=0.40&&g<=0.95){
   const mx=(Math.max(c[i].minX,c[j].minX)+Math.min(c[i].maxX,c[j].maxX))/2;
   const mz=(Math.max(c[i].minZ,c[j].minZ)+Math.min(c[i].maxZ,c[j].maxZ))/2;
   band.push({g:+g.toFixed(3), x:+((c[i].minX+c[i].maxX+c[j].minX+c[j].maxX)/4).toFixed(1),
              z:+((c[i].minZ+c[i].maxZ+c[j].minZ+c[j].maxZ)/4).toFixed(1)});}
 }
 return {n:c.length, near:near.length, band};});
console.log(`colliders ${r.n};  pairs facing each other within 1.6 m: ${r.near};  gaps in the 0.40-0.95 m band: ${r.band.length}`);
const onStreet=r.band.filter(q=>q.x>-45&&q.x<60);
const offMap =r.band.filter(q=>!(q.x>-45&&q.x<60));
console.log(`   of those, ON the playable block (x -45..60): ${onStreet.length}`);
console.log(`   parked off the map (the idle vehicle pool): ${offMap.length}`);
if(onStreet.length){ console.log('\n   on-block gaps in the trap band:');
 for(const q of onStreet.slice(0,14)) console.log(`      ${q.g} m at (${q.x}, ${q.z})`);}
const xs=[...new Set(offMap.map(q=>Math.round(q.x/50)*50))].sort((a,b)=>a-b);
console.log(`\n   off-map clusters near x = ${xs.join(', ')}   (H names x~435 and x~1074)`);
await b.close();
