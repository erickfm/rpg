// "this guy is floating" — the float is in the FRAME, not the transform, so
// mesh-bottom vs groundAt can never see it (C proved the call-site gap is
// 0.000 everywhere). This reads the ATLAS: find the lowest OPAQUE pixel of each
// citizen's own frame, convert it to a world height, and compare THAT to the
// ground. It is the painted shoe that has to touch, not the quad.
// AIM IT. This hardcoded `http://localhost:4184/`, the AUDITOR's port, so it
// could only ever measure the auditor's build — every other builder runs on its
// own port from 4178 up, and H could not point this at the world it had just
// repaired. An instrument that cannot be aimed is an instrument only its author
// can use.
//
// GOTCHAS 26 is this exact family: `24163f69` found 55 of 60 scripts here
// running a bare `p.goto('…:4184/')`. This one survived that sweep.
//
//   node scripts/footpaint.mjs                      # unchanged, still 4184
//   node scripts/footpaint.mjs 4181                 # a port
//   SHOT_URL=http://localhost:4181/ node scripts/footpaint.mjs
//
// The default is deliberately what it used today, so nothing that already calls
// it changes behaviour.
import { chromium } from 'playwright';
const ARG = process.argv[2];
const URL = process.env.SHOT_URL
  ?? (ARG && /^\d+$/.test(ARG) ? `http://localhost:${ARG}/` : ARG)
  ?? 'http://localhost:4184/';
console.log(`footpaint: measuring ${URL}`);
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(URL,{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(3000);
const r=await p.evaluate(()=>{
 const cache=new Map(), out=[];
 const scan=(img,u0,u1,v0,v1)=>{                       // lowest opaque v in the frame
  const W=img.width,H=img.height,key=img;
  let data=cache.get(key);
  if(!data){const c=document.createElement('canvas');c.width=W;c.height=H;
   const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0);
   data=x.getImageData(0,0,W,H).data;cache.set(key,data);}
  const px0=Math.max(0,Math.floor(Math.min(u0,u1)*W)), px1=Math.min(W,Math.ceil(Math.max(u0,u1)*W));
  const py0=Math.max(0,Math.floor((1-Math.max(v0,v1))*H)), py1=Math.min(H,Math.ceil((1-Math.min(v0,v1))*H));
  for(let y=py1-1;y>=py0;y--) for(let x=px0;x<px1;x++)
   if(data[(y*W+x)*4+3]>16) return {v:1-(y+1)/H, rows:py1-py0, rowFromBottom:py1-1-y, W, H};
  return null;};
 window.__ct.scene().traverse(o=>{
  if(!o.isMesh||!o.material?.map?.image||!o.geometry) return;
  const m=o.material.map, img=m.image; if(!img.width||img.width>4096) return;
  const rep=m.repeat, off=m.offset; if(Math.abs(rep.y)>0.9||Math.abs(rep.y)<1e-6) return;  // an atlas frame, not a whole sheet
  o.geometry.computeBoundingBox(); const bb=o.geometry.boundingBox, e=o.matrixWorld.elements;
  if(bb.max.y-bb.min.y<0.5) return;
  let lo=1e9,hi=-1e9,cx=0,cz=0;
  for(const X of [bb.min.x,bb.max.x])for(const Y of [bb.min.y,bb.max.y])for(const Z of [bb.min.z,bb.max.z]){
   const wy=e[1]*X+e[5]*Y+e[9]*Z+e[13]; if(wy<lo)lo=wy; if(wy>hi)hi=wy;}
  cx=e[12]; cz=e[14];
  const v0=off.y, v1=off.y+rep.y, u0=off.x, u1=off.x+rep.x;
  const s=scan(img,u0,u1,v0,v1); if(!s) return;
  const frac=(s.v-Math.min(v0,v1))/Math.abs(rep.y);          // where the shoe sits in the frame
  const footY=lo+frac*(hi-lo);
  const g=window.__ct.groundAt(cx,cz);
  out.push({x:+cx.toFixed(1),z:+cz.toFixed(1),quadBottom:+lo.toFixed(3),footY:+footY.toFixed(3),g:+g.toFixed(3),
   pad:+(frac*(hi-lo)).toFixed(3), rowFromBottom:s.rowFromBottom, rows:s.rows, gap:+(footY-g).toFixed(3)});});
 return out;});
if(!r.length){console.error('CANNOT ANSWER — no atlas-framed figure sampled.');process.exit(3);}
const st=(a)=>{const s=[...a].sort((x,y)=>x-y);return{min:s[0],med:s[s.length>>1],max:s[s.length-1]};};
console.log(`figures read from the atlas: ${r.length}`);
const pad=st(r.map(o=>o.pad)), gap=st(r.map(o=>Math.abs(o.gap)));
console.log(`\nPADDING under the painted shoe (metres of empty frame):  min ${pad.min}  median ${pad.med}  max ${pad.max}`);
console.log(`   C measured 0.108-0.129 before the fix; rows below the shoe: ${[...new Set(r.map(o=>o.rowFromBottom))].sort((a,b)=>a-b).join(',')} of ${[...new Set(r.map(o=>o.rows))].join('/')}`);
console.log(`\nPAINTED SHOE vs GROUND (this is the number the user sees):  |gap| min ${gap.min}  median ${gap.med}  max ${gap.max}`);
const bad=r.filter(o=>Math.abs(o.gap)>0.03);
console.log(`figures whose painted foot is more than 3 cm off the ground: ${bad.length} of ${r.length}`);
for(const o of bad.slice(0,8)) console.log(`   ** (${o.x}, ${o.z}) quad bottom ${o.quadBottom} foot ${o.footY} ground ${o.g}  gap ${o.gap>0?'+':''}${o.gap}`);
// SPLIT BY FRAME HEIGHT: a 64-row frame is a citizen; anything else is not,
// and mixing them is how "2 of 20 float" gets reported about the wrong objects.
const byRows={}; for(const o of r)(byRows[o.rows]??=[]).push(o);
console.log('\nby frame height:');
for(const [rows,a] of Object.entries(byRows)){
  const g2=st(a.map(o=>Math.abs(o.gap))), p2=st(a.map(o=>o.pad));
  const off=a.filter(o=>Math.abs(o.gap)>0.03).length;
  console.log(`  ${String(rows).padStart(3)}-row frames: n=${String(a.length).padStart(3)}  padding med ${p2.med}  painted-foot |gap| med ${g2.med} max ${g2.max}  off-ground ${off}`);
}
const qb=r.filter(o=>Math.abs(o.quadBottom-o.g)>0.03);
console.log(`\nfor contrast, QUAD bottom more than 3 cm off the ground: ${qb.length} of ${r.length}`);
await b.close();
