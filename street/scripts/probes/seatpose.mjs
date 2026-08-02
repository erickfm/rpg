// H: seated pose across all eight sectors - every painted column drops 6 rows,
// every one keeps its feet on row 59, origin at the hip. That is an atlas claim:
// compare the standing frame row against the seated frame row, per column.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(3000);
console.log(await p.evaluate(()=>{
 // the citizen sheet: tallest atlas frame on a person-sized billboard
 let pick=null;
 window.__ct.scene().traverse(o=>{ if(!o.isMesh||!o.geometry)return;
  const mat=Array.isArray(o.material)?o.material[0]:o.material;
  const map=mat&&mat.map&&mat.map.isTexture?mat.map:null; if(!map||!map.image) return;
  if(Math.abs(map.repeat.y)>0.9||Math.abs(map.repeat.y)<1e-6) return;
  o.geometry.computeBoundingBox(); const bb=o.geometry.boundingBox;
  if(bb.max.y-bb.min.y<1.2) return;
  const fh=Math.round(Math.abs(map.repeat.y)*map.image.height);
  if(!pick||fh>pick.fh) pick={img:map.image, fw:Math.round(Math.abs(map.repeat.x)*map.image.width), fh};});
 if(!pick) return 'no citizen sheet found';
 const {img,fw,fh}=pick, W=img.width, H=img.height;
 const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
 const g=cv.getContext('2d',{willReadFrequently:true}); g.drawImage(img,0,0);
 const d=g.getImageData(0,0,W,H).data;
 const cols=Math.round(W/fw), rows=Math.round(H/fh);
 let s=`citizen sheet ${W}x${H}, frame ${fw}x${fh} -> ${cols} cols x ${rows} rows\n\n`;
 s+='  col   STANDING top..bottom   SEATED top..bottom   drop   feet row\n';
 const span=(cx,ry)=>{ let top=-1, bot=-1;
  for(let y=0;y<fh;y++){ let any=false;
   for(let x=0;x<fw;x++) if(d[(((ry*fh)+y)*W + cx*fw + x)*4+3]>16){any=true;break;}
   if(any){ if(top<0) top=y; bot=y; } }
  return [top,bot]; };
 for(let c=0;c<cols;c++){
  const st=span(c,0), se=rows>1?span(c,1):[-1,-1];
  if(st[0]<0){ s+=`   ${c}    (empty)\n`; continue; }
  if(se[0]<0){ s+=`   ${c}    ${st[0]}..${st[1]}   (no seated row)\n`; continue; }
  s+=`   ${c}    ${String(st[0]).padStart(3)}..${String(st[1]).padEnd(3)}          ${String(se[0]).padStart(3)}..${String(se[1]).padEnd(3)}        ${String(se[0]-st[0]).padStart(3)}     ${se[1]}\n`;
 }
 s+='\n  H claims: every column drops 6 rows, every one keeps its feet on row 59\n';
 return s;}));
await b.close();
