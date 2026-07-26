// The body is ONE BoxGeometry with a 6-slot material array — which is exactly
// how [sideT, sideT] gave two faces one texture. So work at that level:
// per material GROUP, derive u -> z from that group's own vertices, read that
// group's own map, and compare the two flanks.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto('http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{
 const kind={2.9:'sedan',2.4:'hatch',3.3:'pickup',3:'van'};
 const out=[], seen=new Set();
 const shutsOf=(img)=>{ const W=img.width,H=img.height;
  const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const g=cv.getContext('2d',{willReadFrequently:true}); g.drawImage(img,0,0);
  const d=g.getImageData(0,0,W,H).data;
  const y0=Math.floor(H*0.40), y1=Math.floor(H*0.78), col=[];
  for(let x=0;x<W;x++){ let s=0,n=0;
   for(let y=y0;y<y1;y++){ const i=(y*W+x)*4; if(d[i+3]<8) continue;
    s+=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2]; n++; }
   col.push(n?s/n:null); }
  const val=col.filter(v=>v!==null); if(val.length<8) return {W,shuts:[]};
  const mean=val.reduce((a,v)=>a+v,0)/val.length, shuts=[];
  for(let x=1;x<W-1;x++){ const v=col[x]; if(v===null) continue;
   const nb=[col[x-1],col[x+1]].filter(q=>q!==null); if(nb.length<2) continue;
   if(v<mean-12 && v<=nb[0] && v<=nb[1]){ if(!shuts.length||x-shuts[shuts.length-1]>2) shuts.push(x); } }
  return {W,shuts}; };
 window.__ct.scene().traverse(g=>{
  const wb=g.userData?.wheelbase; if(wb===undefined) return;
  const k=kind[+wb.toFixed(2)]; if(!k||seen.has(k)) return;
  g.traverse(o=>{ if(seen.has(k)) return;
   if(!o.isMesh||!Array.isArray(o.material)||o.material.length<6) return;
   const geo=o.geometry, pos=geo.attributes?.position, uv=geo.attributes?.uv, idx=geo.index;
   if(!pos||!uv||!geo.groups||geo.groups.length<6) return;
   let zs=[1e9,-1e9]; for(let i=0;i<pos.count;i++){const z=pos.getZ(i); if(z<zs[0])zs[0]=z; if(z>zs[1])zs[1]=z;}
   if(zs[1]-zs[0]<1.5) return;                       // must be the body, not a lamp
   const faces=[];
   for(const grp of geo.groups.slice(0,2)){          // +x then -x
    const vset=new Set();
    for(let i=grp.start;i<grp.start+grp.count;i++) vset.add(idx?idx.getX(i):i);
    let n=0,su=0,sz=0,suu=0,suz=0,mx=0;
    for(const i of vset){ const u=uv.getX(i), z=pos.getZ(i); n++; su+=u; sz+=z; suu+=u*u; suz+=u*z; mx+=pos.getX(i); }
    const den=n*suu-su*su; if(Math.abs(den)<1e-9) continue;
    const m=(n*suz-su*sz)/den, c=(sz-m*su)/n;
    const mat=o.material[grp.materialIndex];
    faces.push({xside:+(mx/n).toFixed(2), m:+m.toFixed(3), c:+c.toFixed(3), mat, hasMap:!!mat?.map});
   }
   if(faces.length<2||!faces[0].hasMap||!faces[1].hasMap) return;
   seen.add(k);
   const sameObject = faces[0].mat.map === faces[1].mat.map;
   const res=faces.map(f=>{ const {W,shuts}=shutsOf(f.mat.map.image);
    const rep=f.mat.map.repeat.x, off=f.mat.map.offset.x;
    return {xside:f.xside, tex:W, same:sameObject,
      z: shuts.map(x=>+(f.m*(off+((x+0.5)/W)*rep)+f.c).toFixed(3)).sort((a,b)=>a-b)}; });
   out.push({kind:k, sameObject, faces:res});
  });
 });
 return out;});
if(!r.length){console.error('CANNOT ANSWER — no 6-slot body box found.');process.exit(3);}
for(const v of r){
 console.log(`\n${v.kind.toUpperCase()}   both faces share ONE texture object: ${v.sameObject}${v.sameObject?'   ** that is the reported fault':'   (each flank has its own paint)'}`);
 for(const f of v.faces) console.log(`   x ${String(f.xside).padStart(6)}  ${String(f.z.length).padStart(2)} features at z: ${f.z.join(', ')}`);
 const [a,b2]=v.faces, near=(x,y)=>Math.abs(x-y)<0.06;
 const m=a.z.filter(z=>b2.z.some(w=>near(z,w))).length;
 console.log(`   -> ${m} of ${Math.max(a.z.length,b2.z.length)} agree within 60 mm  ${a.z.length===b2.z.length&&m===a.z.length?'BOTH FLANKS AGREE':'** SIDES DISAGREE'}`);
}
await b.close();
