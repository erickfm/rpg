// The librarian does not render. Is that one room or all ten? For each keeper:
// where is the PAINTED foot against its own floor - the measurement that
// distinguishes a harmless quad overhang from a figure that is actually sunk.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(3000);
console.log(await p.evaluate(()=>{
 const dims=window.__ct.roomDims(); let s='';
 const cache=new Map();
 const paintedFoot=(o)=>{
  const mat=Array.isArray(o.material)?o.material[0]:o.material;
  const map=mat&&mat.map&&mat.map.isTexture?mat.map:null; if(!map||!map.image) return null;
  const img=map.image, W=img.width, H=img.height;
  let data=cache.get(img);
  if(!data){ const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
   const g=cv.getContext('2d',{willReadFrequently:true}); g.drawImage(img,0,0);
   data=g.getImageData(0,0,W,H).data; cache.set(img,data); }
  const u0=map.offset.x, u1=map.offset.x+map.repeat.x, v0=map.offset.y, v1=map.offset.y+map.repeat.y;
  const px0=Math.max(0,Math.floor(Math.min(u0,u1)*W)), px1=Math.min(W,Math.ceil(Math.max(u0,u1)*W));
  const py0=Math.max(0,Math.floor((1-Math.max(v0,v1))*H)), py1=Math.min(H,Math.ceil((1-Math.min(v0,v1))*H));
  for(let y=py1-1;y>=py0;y--) for(let x=px0;x<px1;x++)
   if(data[(y*W+x)*4+3]>16) return { v: 1-(y+1)/H, v0:Math.min(v0,v1), rep:Math.abs(map.repeat.y) };
  return null; };
 for(const d of dims){
  let found=null;
  window.__ct.scene().traverse(o=>{ if(found||!o.isMesh||!o.geometry)return;
   const e=o.matrixWorld.elements;
   if(Math.abs(e[12]-d.cx)>d.w/2+1||Math.abs(e[14]-d.cz)>d.d/2+1) return;
   const mat=Array.isArray(o.material)?o.material[0]:o.material;
   const map=mat&&mat.map&&mat.map.isTexture?mat.map:null; if(!map) return;
   if(Math.abs(map.repeat.y)>0.9||Math.abs(map.repeat.y)<1e-6) return;
   o.geometry.computeBoundingBox(); const bb=o.geometry.boundingBox;
   let lo=1e9,hi=-1e9;
   for(const X of [bb.min.x,bb.max.x])for(const Y of [bb.min.y,bb.max.y])for(const Z of [bb.min.z,bb.max.z]){
    const wy=e[1]*X+e[5]*Y+e[9]*Z+e[13]; if(wy<lo)lo=wy; if(wy>hi)hi=wy; }
   if(hi-lo<1.0) return;
   const f=paintedFoot(o); if(!f) return;
   const frac=(f.v-f.v0)/f.rep;
   found={x:+e[12].toFixed(1), z:+e[14].toFixed(1), quad:+lo.toFixed(2), top:+hi.toFixed(2),
     foot:+(lo+frac*(hi-lo)).toFixed(2), floor:+window.__ct.groundAt(e[12],e[14]).toFixed(2)};});
  if(!found){ s+=`${d.id.padEnd(9)} no keeper found\n`; continue; }
  const gap=+(found.foot-found.floor).toFixed(2);
  s+=`${d.id.padEnd(9)} painted foot ${String(found.foot).padStart(6)}  floor ${String(found.floor).padStart(5)}  gap ${String(gap).padStart(6)} m  ${Math.abs(gap)<0.06?'stands on it':(gap<0?'** SUNK':'** FLOATING')}\n`;
 }
 return s;}));
await b.close();
