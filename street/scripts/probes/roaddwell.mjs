// "these people are stuck" - pedestrians frozen IN THE ROAD.
// My earlier crossing confirmation counted roadway samples as PROOF crossings
// were happening. That reading is only safe if nobody is stranded there. So:
// per walker, how long in the carriageway, and were they MOVING while in it?
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
const SECS=Number(process.env.SECS||240), HZ=4;
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(6.0,-40,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(1500);
await p.evaluate(([SECS,HZ])=>{ window.__rd={pos:[]};
 const read=()=>{const w=window.__ct.walkers?window.__ct.walkers():[];
  return (w||[]).map(c=>({x:+(c.x??0).toFixed(3), z:+(c.z??0).toFixed(3)}));};
 window.__rdT=setInterval(()=>window.__rd.pos.push(read()),1000/HZ);
 setTimeout(()=>clearInterval(window.__rdT),SECS*1000+500);},[SECS,HZ]);
console.log(`watching ${SECS} s ...`);
await p.waitForTimeout(SECS*1000+1500);
const S=await p.evaluate(()=>window.__rd.pos);
if(!S.length||!S[0].length){console.error('CANNOT ANSWER — no walkers sampled.');process.exit(3);}
const N=S[0].length, dt=1/HZ;
// the carriageway: main street |x|<5.25, side street between the two walks
const inRoad=(q)=> (Math.abs(q.x)<5.25 && q.z>-96 && q.z<15) || (q.z>-108.25 && q.z<-97.75 && q.x>5.25);
console.log(`walkers ${N}, samples ${S.length} over ${(S.length*dt).toFixed(0)} s\n`);
console.log('walker  time in the road   longest UNBROKEN road spell   moving while in it?');
let worstStuck=0, worstWho=null;
for(let i=0;i<N;i++){
 let tot=0, run=0, best=0, bestStill=0, still=0;
 for(let s=0;s<S.length;s++){
  const q=S[s][i]; if(!q) continue;
  if(inRoad(q)){ tot++; run++;
   if(s>0){ const a=S[s-1][i]; const d=Math.hypot(q.x-a.x,q.z-a.z);
     if(d<0.02){ still++; if(still>bestStill) bestStill=still; } else still=0; }
   if(run>best) best=run;
  } else { run=0; still=0; }
 }
 const stuckS=bestStill*dt;
 if(stuckS>worstStuck){worstStuck=stuckS; worstWho=i;}
 console.log(`  ${String(i).padStart(3)}   ${String((tot*dt).toFixed(1)).padStart(8)} s   ${String((best*dt).toFixed(1)).padStart(12)} s   ${stuckS>3?`** STATIONARY ${stuckS.toFixed(1)} s IN THE ROAD`:'yes, kept moving'}`);
}
console.log(`\nworst stationary spell inside the carriageway: ${worstStuck.toFixed(1)} s${worstWho!==null?` (walker ${worstWho})`:''}`);
console.log(worstStuck<3 ? 'nobody was frozen in the road for as long as 3 s' : '** somebody was frozen in the road');
// and did anyone leave the block entirely?
let far=0; for(const row of S) for(const q of row) if(q&&(Math.abs(q.x)>60||q.z>25||q.z<-140)) far++;
console.log(`samples with a walker off the block entirely: ${far}`);
await b.close();
