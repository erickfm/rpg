// "pedestrians pile up and get stuck at the crossing"
// H's before-number: one walker stationary 29.8 s of a 60 s minute, with
// deliberate pauses being 4-8 s (door) and 1.5-4 s (corner). So the test is the
// LONGEST STATIONARY RUN per walker: pauses are fine, parking for 30 s is not.
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
const SECS=Number(process.env.SECS||60), HZ=4;
const b=await chromium.launch(); const p=await b.newPage();
await p.goto('http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(6.0,-40,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(1500);
const api=await p.evaluate(()=>{const w=window.__ct.walkers, q=window.__ct.people;
 const t=(f)=>{try{const v=typeof f==='function'?f():f; return Array.isArray(v)?`array ${v.length}: ${JSON.stringify(v[0]).slice(0,180)}`:typeof v;}catch(e){return 'err '+e.message;}};
 return {walkers:t(w), people:t(q)};});
console.log('walkers:', api.walkers); console.log('people :', api.people);
await p.evaluate(([SECS,HZ])=>{ window.__jam={t:[],pos:[]};
 const read=()=>{ const w=window.__ct.walkers?window.__ct.walkers():(window.__ct.people?window.__ct.people():[]);
  return (w||[]).map(c=>({x:+(c.x ?? c.mesh?.position?.x ?? 0).toFixed(3), z:+(c.z ?? c.mesh?.position?.z ?? 0).toFixed(3),
    doing:c.doing, stuck:c.stuck, jam:c.jam}));};
 window.__jamT=setInterval(()=>{ window.__jam.t.push(performance.now()); window.__jam.pos.push(read()); }, 1000/HZ);
 setTimeout(()=>clearInterval(window.__jamT), SECS*1000+500);},[SECS,HZ]);
console.log(`\nsampling ${SECS} s at ${HZ} Hz ...`);
await p.waitForTimeout(SECS*1000+1500);
const r=await p.evaluate(()=>window.__jam);
if(!r||!r.pos.length||!r.pos[0].length){console.error('CANNOT ANSWER — no walkers sampled.');process.exit(3);}
const N=r.pos[0].length, S=r.pos.length, dt=1/4;
console.log(`walkers ${N}, samples ${S} over ${((r.t[S-1]-r.t[0])/1000).toFixed(1)} s\n`);
const MOVE=0.02;   // metres between samples that counts as moving
const out=[];
for(let i=0;i<N;i++){
 let run=0,best=0,total=0,bestAt=null;
 for(let s=1;s<S;s++){ const a=r.pos[s-1][i], c=r.pos[s][i]; if(!a||!c) continue;
  const d=Math.hypot(c.x-a.x, c.z-a.z); total+=d;
  if(d<MOVE){ run++; if(run>best){best=run; bestAt={x:c.x,z:c.z,doing:c.doing,end:s};} } else run=0; }
 // what was it DOING through that run? one act overrunning is a fault;
 // two acts back to back is the design.
 if(bestAt){ const seq=[]; for(let s=bestAt.end-best+1;s<=bestAt.end;s++){ const v=r.pos[s]?.[i]?.doing; if(seq[seq.length-1]!==v) seq.push(v); } bestAt.seq=seq; }
 out.push({i, still:+(best*dt).toFixed(1), moved:+total.toFixed(1), at:bestAt});
}
out.sort((a,b)=>b.still-a.still);
console.log('walker  longest STILL run   distance walked   where it stalled');
for(const o of out) console.log(`  ${String(o.i).padStart(3)}   ${String(o.still).padStart(8)} s   ${String(o.moved).padStart(11)} m   ${o.at?`(${o.at.x}, ${o.at.z}) acts=[${(o.at.seq||[]).join(' -> ')}]`:'-'}`);
const worst=out[0];
console.log(`\nWORST stationary run: ${worst.still} s   (H measured 29.8 s before the fix; deliberate pauses are 4-8 s)`);
console.log(`walkers that never moved at all: ${out.filter(o=>o.moved<0.5).length} of ${N}`);
// POSITIVE CONTROL: did anyone actually CROSS during the sample? "no jam at
// the crossing" measured over a minute in which nobody crossed is an empty set.
let crossings=0, roadSamples=0;
for(let i=0;i<N;i++){ let side=Math.sign(r.pos[0][i].x);
 for(let s=1;s<S;s++){ const x=r.pos[s][i].x; if(Math.abs(x)<5.25) roadSamples++;
  const sd=Math.sign(x); if(sd!==0&&side!==0&&sd!==side){crossings++; side=sd;} else if(sd!==0) side=sd; }}
console.log(`\nPOSITIVE CONTROL — kerb-to-kerb crossings during the sample: ${crossings}`);
console.log(`  samples with a walker in the roadway (|x| < 5.25): ${roadSamples} of ${S*N}`);
if(!crossings){ console.error('  ** NOBODY CROSSED. "no jam at the crossing" would be an empty set, not a pass.'); }
// pile-ups: most walkers within 1.5 m of each other at any instant
let maxCluster=0, at=null;
for(let s=0;s<S;s++){ const P=r.pos[s];
 for(let i=0;i<N;i++){ let n=1; for(let j=0;j<N;j++) if(i!==j&&Math.hypot(P[i].x-P[j].x,P[i].z-P[j].z)<1.5) n++;
  if(n>maxCluster){maxCluster=n; at={x:P[i].x,z:P[i].z,s};} }}
console.log(`largest pile-up seen: ${maxCluster} walkers within 1.5 m${at?`, at (${at.x}, ${at.z}) sample ${at.s}`:''}`);
await b.close();
