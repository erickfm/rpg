// "confirm the logic independently per side of the car"
// For each side quad: derive u -> local z from ITS OWN vertex data (not from an
// assumed convention), find the dark shut columns in ITS OWN texture, and map
// them to z. Then compare the two flanks. If the paint is mirrored correctly the
// two sides put the same features at the same z.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{
 const kind={2.9:'sedan',2.4:'hatch',3.3:'pickup',3:'van'};
 const out=[];
 const seen=new Set();
 window.__ct.scene().traverse(g=>{
  const wb=g.userData?.wheelbase; if(wb===undefined) return;
  const k=kind[+wb.toFixed(2)]; if(!k||seen.has(k)) return;
  const sides=[];
  g.traverse(o=>{ if(!o.isMesh||!o.geometry?.attributes?.uv||!o.material?.map?.image) return;
   const pos=o.geometry.attributes.position, uv=o.geometry.attributes.uv;
   let xs=[1e9,-1e9], zs=[1e9,-1e9];
   for(let i=0;i<pos.count;i++){ const X=pos.getX(i), Z=pos.getZ(i);
    if(X<xs[0])xs[0]=X; if(X>xs[1])xs[1]=X; if(Z<zs[0])zs[0]=Z; if(Z>zs[1])zs[1]=Z; }
   // a FLANK: thin in x, long in z
   if((xs[1]-xs[0])>0.05 || (zs[1]-zs[0])<1.5) return;
   // derive u -> z from this quad's own vertices
   let n=0,su=0,sz=0,suu=0,suz=0;
   for(let i=0;i<pos.count;i++){ const u=uv.getX(i), z=pos.getZ(i); n++; su+=u; sz+=z; suu+=u*u; suz+=u*z; }
   const den=n*suu-su*su; if(Math.abs(den)<1e-9) return;
   const m=(n*suz-su*sz)/den, c=(sz-m*su)/n;      // z = m*u + c
   sides.push({x:+((xs[0]+xs[1])/2).toFixed(3), m:+m.toFixed(3), c:+c.toFixed(3), mat:o.material, img:o.material.map.image,
     rep:o.material.map.repeat.x, off:o.material.map.offset.x});
  });
  if(sides.length<2) return;
  seen.add(k);
  // read each side's texture and find dark columns
  const readShuts=(s)=>{
   const img=s.img, W=img.width, H=img.height;
   const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
   const g2=cv.getContext('2d',{willReadFrequently:true}); g2.drawImage(img,0,0);
   const d=g2.getImageData(0,0,W,H).data;
   const y0=Math.floor(H*0.45), y1=Math.floor(H*0.75);
   const col=[]; for(let x=0;x<W;x++){ let s2=0,n2=0;
    for(let y=y0;y<y1;y++){ const i=(y*W+x)*4; if(d[i+3]<8) continue;
     s2+=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2]; n2++; }
    col.push(n2?s2/n2:null); }
   const val=col.filter(v=>v!==null); if(val.length<8) return {W,shuts:[]};
   const mean=val.reduce((a,v)=>a+v,0)/val.length;
   const shuts=[];
   for(let x=2;x<W-2;x++){ const v=col[x]; if(v===null) continue;
    const nb=[col[x-2],col[x-1],col[x+1],col[x+2]].filter(q=>q!==null);
    if(!nb.length) continue;
    if(v<mean-14 && v<=Math.min(...nb)) { if(!shuts.length||x-shuts[shuts.length-1]>3) shuts.push(x); } }
   return {W,shuts};
  };
  const res=sides.slice(0,2).map(s=>{ const {W,shuts}=readShuts(s);
   // texture column -> u -> local z, honouring this material's own repeat/offset
   const zs=shuts.map(x=>{ const u=(x+0.5)/W; const uu=s.off + u*s.rep; return +(s.m*uu + s.c).toFixed(3); });
   return {x:s.x, rep:+s.rep.toFixed(3), off:+s.off.toFixed(3), m:s.m, c:s.c, texW:W, cols:shuts.length, z:zs.sort((a,b)=>a-b)};});
  out.push({kind:k, sides:res});
 });
 return out;});
if(!r.length){console.error('CANNOT ANSWER — no flank quad with its own uv+texture found.');process.exit(3);}
for(const v of r){
 console.log(`\n${v.kind.toUpperCase()}`);
 for(const s of v.sides) console.log(`  side x ${String(s.x).padStart(7)}  u->z: z = ${s.m}u + ${s.c}   tex ${s.texW}px  repeat ${s.rep} offset ${s.off}`);
 const [a,bb]=v.sides;
 console.log(`  side ${a.x} feature z: ${a.z.join(', ')}`);
 console.log(`  side ${bb.x} feature z: ${bb.z.join(', ')}`);
 const near=(p,q)=>Math.abs(p-q)<0.06;
 const matched=a.z.filter(z=>bb.z.some(w=>near(z,w)));
 console.log(`  -> ${matched.length} of ${Math.max(a.z.length,bb.z.length)} features agree within 60 mm  ${matched.length===Math.max(a.z.length,bb.z.length)&&a.z.length===bb.z.length?'BOTH FLANKS AGREE':'** SIDES DISAGREE'}`);
}
await b.close();
