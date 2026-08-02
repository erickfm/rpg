// "the tree is transparent when you look up through it". Stand UNDER each street
// tree, look straight up, and measure how much of the view is sky. B claims the
// worst went 100% -> 37%. The open-sky control is what makes the number mean
// something: if a clear patch does not read ~100%, the classifier is wrong.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
import fs from 'fs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:800,height:600}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1500);
await p.evaluate(()=>window.__ct.clock(13,0)); await afterFrames(p,6);
// canopy groups: green-ish meshes whose centre is above 3 m, clustered in xz
const trees=await p.evaluate(()=>{
  const s=window.__ct.scene(); s.updateMatrixWorld(true); const pts=[];
  s.traverse(o=>{ if(!o.isMesh||!o.geometry) return;
    if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const cy=(bb.min.y+bb.max.y)/2; if(cy<3.2||cy>12) return;
    const w=bb.max.x-bb.min.x, d=bb.max.z-bb.min.z; if(w<1.0||d<1.0) return;
    const m=Array.isArray(o.material)?o.material[0]:o.material; if(!m||!m.color) return;
    const c=m.color; if(!(c.g>=c.r&&c.g>=c.b)) return;
    const cx=(bb.min.x+bb.max.x)/2, cz=(bb.min.z+bb.max.z)/2;
    if(cx>100) return;                 // the interior belt is not outdoors
    pts.push([cx,cz]); });
  const cl=[];
  for(const [x,z] of pts){ const f=cl.find(c=>Math.hypot(c.x-x,c.z-z)<2.5);
    if(f){ f.x=(f.x*f.n+x)/(f.n+1); f.z=(f.z*f.n+z)/(f.n+1); f.n++; } else cl.push({x,z,n:1}); }
  return cl.filter(c=>c.n>=2).map(c=>[+c.x.toFixed(2),+c.z.toFixed(2),c.n]); });
console.log(`\ncanopy clusters found: ${trees.length}`);
const dec=await b.newPage(); await dec.goto('about:blank');
const skyFrac=async(file)=>dec.evaluate(async(b64)=>{
  const img=await createImageBitmap(await (await fetch('data:image/png;base64,'+b64)).blob());
  const cv=document.createElement('canvas'); cv.width=img.width; cv.height=img.height;
  const g=cv.getContext('2d'); g.drawImage(img,0,0);
  // TIGHT CONE. 280x280 was a wide cone that swept in off-axis sky past the
  // canopy edge and diluted the thing being asked about: sky seen THROUGH the
  // leaves directly overhead.
  const R=Number(globalThis.__crop||90);
  const x0=(cv.width>>1)-(R>>1), y0=(cv.height>>1)-(R>>1);
  const d=g.getImageData(x0,y0,R,R).data;
  let sky=0,n=0;
  for(let i=0;i<d.length;i+=4){ const r=d[i],gg=d[i+1],bl=d[i+2];
    if(bl>r+8 && (r+gg+bl)/3>110) sky++; n++; }
  return sky/n; },fs.readFileSync(file).toString('base64'));
const look=async(tag,x,z)=>{
  await p.evaluate(([x,z])=>window.__ct.warp(x,z,0,window.__ct.groundAt(x,z),1.35),[x,z]);
  await afterFrames(p,5);
  const f=`shots/sky-${tag}.png`; await p.screenshot({path:f});
  return skyFrac(f); };
// PAIRED SAMPLING. My first control was "open pavement", which in a street
// canyon has walls overhead and read 55% and 27% sky instead of ~100% - it was
// measuring the canyon, not the canopy. Each tree is now compared with a
// station 3.5 m to its side, same canyon, same sky, canopy or not.
console.log(`\n  UNDER each canopy vs 3.5 m BESIDE it (same surroundings):`);
const res=[], deltas=[];
for(let i=0;i<Math.min(trees.length,14);i++){ const [x,z,n]=trees[i];
  const under=await look(`tree${i}`,x,z);
  const beside=await look(`tree${i}-off`,x+3.5,z);
  res.push(under); deltas.push(beside-under);
  console.log(`    (${String(x).padStart(7)}, ${String(z).padStart(7)})  under ${(100*under).toFixed(0).padStart(3)}%   beside ${(100*beside).toFixed(0).padStart(3)}%   canopy blocks ${(100*(beside-under)).toFixed(0).padStart(3)} points`); }
await b.close();
if(res.length){
  const sr=[...res].sort((a,c)=>a-c), sd=[...deltas].sort((a,c)=>a-c);
  console.log(`\n  under a canopy: worst ${(100*sr[sr.length-1]).toFixed(0)}% sky, median ${(100*sr[sr.length>>1]).toFixed(0)}%`);
  console.log(`  canopy vs beside: median ${(100*sd[sd.length>>1]).toFixed(0)} points blocked, worst tree ${(100*sd[0]).toFixed(0)}`);
  console.log(`  ${sd[0]>0.05?'every canopy blocks more sky than the gap beside it':'** at least one canopy blocks no more than open sky'}`);
}
