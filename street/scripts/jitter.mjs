// "this red guy glitches back and forth as he walks sometimes idk why"
// Back-and-forth is a DIRECTION REVERSAL: consecutive movement vectors pointing
// more than 90 degrees apart while the walker is actually moving.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
const SECS=Number(process.env.SECS||240), HZ=8;
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(6.0,-40,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(1500);
await p.evaluate(([SECS,HZ])=>{ window.__jt={pos:[]};
 const read=()=>{const w=window.__ct.walkers?window.__ct.walkers():[];
  return (w||[]).map(c=>({x:+(c.x??0).toFixed(4), z:+(c.z??0).toFixed(4)}));};
 window.__jtT=setInterval(()=>window.__jt.pos.push(read()),1000/HZ);
 setTimeout(()=>clearInterval(window.__jtT),SECS*1000+500);},[SECS,HZ]);
console.log(`watching ${SECS} s at ${HZ} Hz ...`);
await p.waitForTimeout(SECS*1000+1500);
const S=await p.evaluate(()=>window.__jt.pos);
if(!S.length||!S[0].length){console.error('CANNOT ANSWER — no walkers sampled.');process.exit(3);}
const N=S[0].length, dt=1/HZ, MOVE=0.01;
console.log(`walkers ${N}, samples ${S.length} over ${(S.length*dt).toFixed(0)} s\n`);
console.log('walker  moving samples   reversals >90deg   per minute   worst run of flips');
let tot=0;
for(let i=0;i<N;i++){
 const v=[];
 for(let s=1;s<S.length;s++){ const a=S[s-1][i], c=S[s][i]; if(!a||!c){v.push(null);continue;}
  const dx=c.x-a.x, dz=c.z-a.z; v.push(Math.hypot(dx,dz)>=MOVE?[dx,dz]:null); }
 let moving=0, rev=0, run=0, worst=0;
 for(let s=1;s<v.length;s++){ if(!v[s]) {run=0; continue;} moving++;
  if(!v[s-1]) {run=0; continue;}
  const [ax,az]=v[s-1], [bx,bz]=v[s];
  const dot=(ax*bx+az*bz)/(Math.hypot(ax,az)*Math.hypot(bx,bz));
  if(dot<0){ rev++; run++; if(run>worst)worst=run; } else run=0; }
 tot+=rev;
 const perMin = moving? rev/(moving*dt/60) : 0;
 console.log(`  ${String(i).padStart(3)}   ${String(moving).padStart(9)}   ${String(rev).padStart(12)}   ${perMin.toFixed(2).padStart(9)}   ${worst}`);
}
console.log(`\ntotal direction reversals across all walkers: ${tot}`);
console.log(tot===0 ? 'no walker reversed direction while moving — no back-and-forth'
  : `**${tot} reversals — back-and-forth is present`);
await b.close();
