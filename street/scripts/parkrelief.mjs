// Does the park have topography a PLAYER feels? Grid-sample the floor the
// movement code itself reads, across the whole 32 x 30 m site.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const U=process.env.SHOT_URL ?? 'http://localhost:4184/';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(U,{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await reportWorld(p,U);
const g=await p.evaluate(()=>{
  const out=[];
  for(let x=-38.5;x<=-7.5;x+=0.5)
    for(let z=-97.5;z<=-68.5;z+=0.5){
      const y=window.__ct.groundAt(x,z);
      if(typeof y==='number'&&isFinite(y)) out.push({x:+x.toFixed(1),z:+z.toFixed(1),y:+y.toFixed(3)});
    }
  return out;
});
await b.close();
const ys=g.map(o=>o.y).sort((a,c)=>a-c);
const q=f=>ys[Math.floor(f*(ys.length-1))];
const lo=ys[0], hi=ys[ys.length-1];
console.log(`samples ${g.length} over the park (0.5 m grid)`);
console.log(`  min ${lo.toFixed(3)}   max ${hi.toFixed(3)}   RANGE ${(hi-lo).toFixed(3)} m`);
console.log(`  p10 ${q(.1).toFixed(3)}  median ${q(.5).toFixed(3)}  p90 ${q(.9).toFixed(3)}`);
const band={}; for(const o of g){ const k=(Math.round(o.y*20)/20).toFixed(2); band[k]=(band[k]||0)+1; }
console.log('  height bands (0.05 m):');
for(const [k,n] of Object.entries(band).sort((a,c)=>+a[0]-+c[0])) console.log(`     ${k} m  ${'#'.repeat(Math.max(1,Math.round(n/g.length*60)))} ${(n/g.length*100).toFixed(1)}%`);
const peak=g.slice().sort((a,c)=>c.y-a.y)[0];
console.log(`  highest point ${peak.y} at (${peak.x}, ${peak.z})`);
// how much rise does a walker meet crossing the middle?
const line=g.filter(o=>Math.abs(o.z+83)<0.26).sort((a,c)=>a.x-c.x);
console.log(`  crossing the middle west->east at z -83: ${line.map(o=>o.y.toFixed(2)).filter((_,i)=>i%6===0).join(' ')}`);
