// Working the 28 CONFIRMED-with-nothing-under-them, cheapest first.
// Three here, each with the STATION or predicate that settles it.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:900,height:600}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1200);
const pos=()=>p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
const hold=async(k,ms)=>{ await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); await p.waitForTimeout(90); };

// ── 1. "library steps climbable" — E recorded gy 0.42 -> 0.99
console.log(`\n1. LIBRARY STEPS — walk the civic flight`);
const lib=await p.evaluate(()=>window.__ct.doors().find(d=>/LIBRARY/i.test(d.building)));
console.log(`   library street door at (${lib.point.x.toFixed(2)}, ${lib.point.z.toFixed(2)}), stand (${lib.stand.x.toFixed(2)}, ${lib.stand.z.toFixed(2)})`);
// OUTWARD, not inward. I subtracted the normal, which put the station inside the
// building; the warp was refused and the player stayed at the apartment spawn,
// so the run measured nothing and printed 'did not climb' about the wrong place.
const sx=lib.stand.x + lib.point.nx*3.0, sz=lib.stand.z + lib.point.nz*3.0;
await p.evaluate(([x,z,y])=>window.__ct.warp(x,z,y,window.__ct.groundAt(x,z),0),
  [sx,sz,Math.atan2(-lib.point.nx,-(-lib.point.nz))]);
await afterFrames(p,5); await p.waitForTimeout(300);
const a=await pos();
if(Math.hypot(a[0]-sx,a[2]-sz)>1.0){ console.log(`   ** NOT STARTED: asked (${sx.toFixed(2)}, ${sz.toFixed(2)}), landed (${a[0]}, ${a[2]}). Not pressing a key.`); }
const seen=[];
for(let i=0;i<22;i++){ await hold('w',120); const q=await pos(); seen.push(q[3]); }
const c=await pos();
const lv=[...new Set(seen.map(v=>v.toFixed(2)))];
console.log(`   (${a[0]}, ${a[2]}) gy ${a[3]}  ->  (${c[0]}, ${c[2]}) gy ${c[3]}   climbed ${(c[3]-a[3]).toFixed(2)} m`);
console.log(`   distinct ground levels underfoot: ${lv.length}  ${lv.join(' ')}`);
console.log(`   ${c[3]>a[3]+0.30 ? 'CLIMBABLE — the flight lifts you' : '** did not climb'}`);

// ── 2. "bodega entry blocker" — nothing may stand in the doorway
console.log(`\n2. BODEGA ENTRY — the doorway must be clear`);
const bod=await p.evaluate(()=>window.__ct.doors().find(d=>/BODEGA/i.test(d.building)));
const blocked=await p.evaluate(([x,z])=>{
  const cs=window.__ct.colliders();
  return cs.filter(c=>x>c.minX-0.2&&x<c.maxX+0.2&&z>c.minZ-0.2&&z<c.maxZ+0.2).length; },
  [bod.stand.x,bod.stand.z]);
await p.evaluate(([x,z,y])=>window.__ct.warp(x,z,y,window.__ct.groundAt(x,z),0),
  [bod.stand.x,bod.stand.z,Math.atan2(-bod.point.nx,bod.point.nz)]);
await afterFrames(p,5);
const at=await pos();
const pr=await p.evaluate(()=>{const m=(document.body.innerText||'').match(/\[E\][^\n]*/);return m?m[0].trim():null;});
console.log(`   stand point (${bod.stand.x.toFixed(2)}, ${bod.stand.z.toFixed(2)}) — landed (${at[0]}, ${at[2]})  colliders overlapping it: ${blocked}`);
console.log(`   prompt there: ${JSON.stringify(pr)}`);
console.log(`   ${pr&&/BODEGA/i.test(pr)&&Math.hypot(at[0]-bod.stand.x,at[2]-bod.stand.z)<0.6 ? 'ENTRY CLEAR — you can stand at the door and it offers' : '** entry not clear'}`);

// ── 3. "night: road darkened" — the carriageway must fall at night
console.log(`\n3. NIGHT ROAD — the carriageway must darken`);
// RENDERED PIXELS, not material.color. The tint read 1.000 at both hours because
// material.color on a textured road is a white multiplier - the trap this project
// has recorded six times. Stand mid-block looking down at the carriageway and
// measure what is actually drawn.
const shot=async(h,tag)=>{ await p.evaluate((h)=>window.__ct.clock(h,0),h); await afterFrames(p,8); await p.waitForTimeout(600);
  await p.evaluate(()=>window.__ct.warp(0,-58,0,window.__ct.groundAt(0,-58),-0.62));
  await afterFrames(p,5); await p.screenshot({path:`shots/road-${tag}.png`}); return `shots/road-${tag}.png`; };
const fd=await shot(13,'day'), fn=await shot(23,'night');
const dec=await b.newPage(); await dec.goto('about:blank');
const fs=await import('fs');
const mean=async(f)=>dec.evaluate(async(b64)=>{
  const img=await createImageBitmap(await (await fetch('data:image/png;base64,'+b64)).blob());
  const cv=document.createElement('canvas'); cv.width=img.width; cv.height=img.height;
  const g=cv.getContext('2d'); g.drawImage(img,0,0);
  const d=g.getImageData(0,Math.floor(cv.height*0.55),cv.width,Math.floor(cv.height*0.3)).data;
  let s=0; for(let i=0;i<d.length;i+=4) s+=(d[i]+d[i+1]+d[i+2])/3;
  return +(s/(d.length/4)).toFixed(1); },fs.readFileSync(f).toString('base64'));
const dm=await mean(fd), nm=await mean(fn);
console.log(`   carriageway as DRAWN, mid-block at (0,-58) looking down:`);
console.log(`   day ${dm}   night ${nm}   ratio ${(nm/dm).toFixed(3)}`);
console.log(`   ${nm<dm*0.7 ? 'THE ROAD DARKENS' : '** the road does not darken'}`);
await b.close();
