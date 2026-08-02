// "legs on these people is still off from the side, looks backwards on the feet"
// H's diagnosis: the shoe was symmetric about the ankle, and a symmetric foot
// cannot say which way it points. That lives in the ATLAS, so measure it there:
// per frame, find the leg centre and the shoe's extent each side of it.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(3000);
console.log(await p.evaluate(()=>{
 // one citizen billboard: atlas-framed, tall
 // enumerate every atlas-framed billboard and pick the PERSON one: tall frames
 // (citizens use 64-row frames) on a mesh about 1.8 m high. The first match is
 // not good enough - it picked a 13x12 prop sprite last time.
 const cands=[];
 window.__ct.scene().traverse(m=>{ if(!m.isMesh||!m.material?.map?.image||!m.geometry) return;
  const rep=m.material.map.repeat; if(Math.abs(rep.y)>0.9||Math.abs(rep.y)<1e-6) return;
  m.geometry.computeBoundingBox(); const bb=m.geometry.boundingBox;
  const h=bb.max.y-bb.min.y; if(h<1.2) return;
  const im=m.material.map.image;
  cands.push({mat:m.material, fh:Math.round(Math.abs(rep.y)*im.height), fw:Math.round(Math.abs(rep.x)*im.width),
    W:im.width, H:im.height, meshH:+h.toFixed(2)});});
 if(!cands.length) return 'no tall billboard found';
 const uniq=[...new Map(cands.map(c=>[c.W+'x'+c.H+'/'+c.fw+'x'+c.fh, c])).values()];
 let hdr='candidate atlases on tall billboards:\n';
 for(const c of uniq) hdr+=`   atlas ${c.W}x${c.H}  frame ${c.fw}x${c.fh}  mesh ${c.meshH} m\n`;
 const pick=uniq.sort((a,b)=>b.fh-a.fh)[0];
 hdr+=`-> using the tallest frame: ${pick.fw}x${pick.fh}\n\n`;
 const mat=pick.mat;
 if(!mat) return 'no citizen billboard found';
 const img=mat.map.image, W=img.width, H=img.height;
 const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
 const g=cv.getContext('2d',{willReadFrequently:true}); g.drawImage(img,0,0);
 const d=g.getImageData(0,0,W,H).data;
 const rep=mat.map.repeat, fw=Math.round(Math.abs(rep.x)*W), fh=Math.round(Math.abs(rep.y)*H);
 let s=hdr+`atlas ${W}x${H}, frame ${fw}x${fh} -> ${Math.round(W/fw)} cols x ${Math.round(H/fh)} rows\n\n`;
 s+='  col  leg centre  shoe centre  shoe span   ahead of ankle  behind ankle   asymmetric?\n';
 const cols=Math.round(W/fw);
 for(let c=0;c<cols;c++){
  const x0=c*fw, y0=0;                                    // top row of frames
  const opaque=(x,y)=>d[((y0+y)*W+(x0+x))*4+3]>16;
  // leg band: a few rows above the foot; foot band: the bottom opaque rows
  let botY=-1; for(let y=fh-1;y>=0;y--){ let any=false; for(let x=0;x<fw;x++) if(opaque(x,y)){any=true;break;} if(any){botY=y;break;} }
  if(botY<0){ s+=`  ${c}    (empty frame)\n`; continue; }
  const shoeRows=[botY-1,botY], legRows=[botY-7,botY-6,botY-5];
  const span=(rows)=>{let lo=1e9,hi=-1e9; for(const y of rows){ if(y<0)continue;
    for(let x=0;x<fw;x++) if(opaque(x,y)){ if(x<lo)lo=x; if(x>hi)hi=x; } } return lo>hi?null:[lo,hi];};
  const leg=span(legRows), shoe=span(shoeRows);
  if(!leg||!shoe){ s+=`  ${c}    (no leg or shoe band)\n`; continue; }
  const ankle=(leg[0]+leg[1])/2;
  const ahead=+(shoe[1]-ankle).toFixed(1), behind=+(ankle-shoe[0]).toFixed(1);
  const asym=Math.abs(ahead-behind);
  s+=`   ${c}    ${String(ankle.toFixed(1)).padStart(6)}      ${String(((shoe[0]+shoe[1])/2).toFixed(1)).padStart(6)}     ${shoe[1]-shoe[0]+1} px    ${String(ahead).padStart(8)}      ${String(behind).padStart(7)}     ${asym>=2?`YES, ${asym.toFixed(1)} px longer ${ahead>behind?'in front':'behind'}`:`** SYMMETRIC (${asym.toFixed(1)} px)`}\n`;
 }
 return s;}));
await b.close();
