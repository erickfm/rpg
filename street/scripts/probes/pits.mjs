// "make the dirt patch a lil bigger on the curb side"
// B: PIT_X = TRUNK_X, 0.56 wide (0.28 each side, was 0.18 kerb-side), 1.4 long,
// kerb strip 0.117 identical at all seven.
// My earlier finder failed here by pairing a WEST trunk with an EAST pit, so
// match strictly within the same side AND within 1 m of z.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{
 const pits=[], trunks=[];
 window.__ct.scene().traverse(o=>{ if(!o.isMesh||!o.geometry)return;
  o.geometry.computeBoundingBox(); const bb=o.geometry.boundingBox,m=o.matrixWorld.elements;
  let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  for(const X of [bb.min.x,bb.max.x])for(const Y of [bb.min.y,bb.max.y])for(const Z of [bb.min.z,bb.max.z]){
   const v=[m[0]*X+m[4]*Y+m[8]*Z+m[12],m[1]*X+m[5]*Y+m[9]*Z+m[13],m[2]*X+m[6]*Y+m[10]*Z+m[14]];
   for(let i=0;i<3;i++){if(v[i]<mn[i])mn[i]=v[i];if(v[i]>mx[i])mx[i]=v[i];}}
  if(mn[0]>200) return;
  const w=mx[0]-mn[0], h=mx[1]-mn[1], d=mx[2]-mn[2];
  if(Math.abs(mn[0])<4.5||Math.abs(mn[0])>8.5) return;          // the walk band only
  if(h<0.1 && w>0.3 && w<1.0 && d>0.8 && d<2.2)
    pits.push({x0:+mn[0].toFixed(3),x1:+mx[0].toFixed(3),z:+((mn[2]+mx[2])/2).toFixed(2),
      w:+w.toFixed(3), d:+d.toFixed(3)});
  if(h>1.5 && w<0.45 && d<0.45 && mn[1]<0.6)
    trunks.push({x:+((mn[0]+mx[0])/2).toFixed(3), z:+((mn[2]+mx[2])/2).toFixed(2), w:+w.toFixed(3)});
 });
 return {pits,trunks};});
const {pits,trunks}=r;
if(!pits.length){console.error('CANNOT ANSWER — no tree pit matched.');process.exit(3);}
console.log(`pits ${pits.length}, trunks ${trunks.length}\n`);
console.log('  pit x-range        width  length   trunk x   offset   kerb-side dirt   building-side dirt');
let bad=0;
for(const q of pits.sort((a,b)=>b.z-a.z)){
 // same side of the street AND within 1 m of z - the pairing my old finder got wrong
 const side=Math.sign(q.x0);
 const t=trunks.filter(t=>Math.sign(t.x)===side && Math.abs(t.z-q.z)<1.0)
   .sort((a,b)=>Math.abs(a.z-q.z)-Math.abs(b.z-q.z))[0];
 if(!t){ console.log(`  z ${String(q.z).padStart(7)}  ${q.x0}..${q.x1}  w ${q.w}  L ${q.d}   NO TRUNK within 1 m on this side`); bad++; continue; }
 const off=+( (t.x) - (q.x0+q.x1)/2 ).toFixed(3);
 // kerb is at |x| 5.25; the kerb side is the smaller |x| edge
 const kerbEdge = side>0 ? q.x0 : q.x1;
 const kerbDirt = +(Math.abs(Math.abs(kerbEdge) - Math.abs(t.x))).toFixed(3);
 const bldDirt  = +(q.w - kerbDirt).toFixed(3);
 console.log(`  z ${String(q.z).padStart(7)}  ${q.x0}..${q.x1}  w ${q.w}  L ${q.d}   ${t.x}   ${off>=0?'+':''}${off}      ${kerbDirt}            ${bldDirt.toFixed(3)}`);
 if(Math.abs(off)>0.03) bad++;
}
console.log(`\npits whose trunk is off-centre by more than 30 mm: ${bad} of ${pits.length}`);
const ws=pits.map(q=>q.w), ds=pits.map(q=>q.d);
console.log(`width  min ${Math.min(...ws)} max ${Math.max(...ws)}   (B says 0.56)`);
console.log(`length min ${Math.min(...ds)} max ${Math.max(...ds)}   (B says 1.4)`);
await b.close();
