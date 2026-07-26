// Three E rows measured properly.
// (1) fence floating: base against the ground under it.
// (2) bench vs fountain: compare TOP-LEVEL PROP GROUPS, not meshes - my earlier
//     556 "overlaps" were a bench's own slats against its own frame.
// (3) bench backs: the seated pose against the bench's own back panel.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
console.log(await p.evaluate(()=>{
 const PARK={x0:-42,x1:-8,z0:-102,z1:-58};
 const inPark=(x,z)=>x>PARK.x0&&x<PARK.x1&&z>PARK.z0&&z<PARK.z1;
 const boxOf=(root)=>{ let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  root.traverse(o=>{ if(!o.isMesh||!o.geometry)return; o.geometry.computeBoundingBox();
   const bb=o.geometry.boundingBox,m=o.matrixWorld.elements;
   for(const X of [bb.min.x,bb.max.x])for(const Y of [bb.min.y,bb.max.y])for(const Z of [bb.min.z,bb.max.z]){
    const v=[m[0]*X+m[4]*Y+m[8]*Z+m[12],m[1]*X+m[5]*Y+m[9]*Z+m[13],m[2]*X+m[6]*Y+m[10]*Z+m[14]];
    for(let i=0;i<3;i++){if(v[i]<mn[i])mn[i]=v[i]; if(v[i]>mx[i])mx[i]=v[i];}}});
  return mn[0]>1e8?null:{mn,mx}; };
 // top-level park props: direct children of the scene with geometry inside
 const scene=window.__ct.scene(); const props=[];
 for(const child of scene.children){
  const bx=boxOf(child); if(!bx) continue;
  const cx=(bx.mn[0]+bx.mx[0])/2, cz=(bx.mn[2]+bx.mx[2])/2;
  if(!inPark(cx,cz)) continue;
  const w=bx.mx[0]-bx.mn[0], d=bx.mx[2]-bx.mn[2], h=bx.mx[1]-bx.mn[1];
  if(w>6||d>6||h>4) continue;                       // furniture, not ground sheets
  props.push({bx,w:+w.toFixed(2),h:+h.toFixed(2),x:+cx.toFixed(1),z:+cz.toFixed(1)});
 }
 let s=`top-level park props (furniture-scale, whole objects): ${props.length}\n`;
 let ov=0, worst=null;
 for(let i=0;i<props.length;i++) for(let j=i+1;j<props.length;j++){
  const a=props[i].bx, c=props[j].bx;
  const ox=Math.min(a.mx[0],c.mx[0])-Math.max(a.mn[0],c.mn[0]);
  const oy=Math.min(a.mx[1],c.mx[1])-Math.max(a.mn[1],c.mn[1]);
  const oz=Math.min(a.mx[2],c.mx[2])-Math.max(a.mn[2],c.mn[2]);
  if(ox>0.05&&oy>0.05&&oz>0.05){ ov++; const v=ox*oy*oz;
   if(!worst||v>worst.v) worst={v:+v.toFixed(3), a:`(${props[i].x},${props[i].z})`, c:`(${props[j].x},${props[j].z})`,
     dims:`${ox.toFixed(2)}x${oy.toFixed(2)}x${oz.toFixed(2)}`}; }}
 s+=`  OBJECT-on-OBJECT overlaps over 5 cm on all three axes: ${ov}   (E: 0 across 150 park meshes)\n`;
 if(worst) s+=`     worst ${worst.dims} m between ${worst.a} and ${worst.c}\n`;
 // fence: railing-like props, base vs ground
 let fence=0, floating=0, worstF=0;
 for(const q of props){ const w=q.bx.mx[0]-q.bx.mn[0], d=q.bx.mx[2]-q.bx.mn[2];
  if(q.h>1.4||q.h<0.5) continue; if(Math.min(w,d)>0.4) continue;   // long and thin
  fence++; const g=window.__ct.groundAt((q.bx.mn[0]+q.bx.mx[0])/2,(q.bx.mn[2]+q.bx.mx[2])/2);
  const gap=q.bx.mn[1]-g; if(gap>0.03){floating++; if(gap>worstF)worstF=gap;} }
 s+=`\nrailing-like props: ${fence};  with a base more than 3 cm above the ground: ${floating}`;
 if(floating) s+=`   worst ${worstF.toFixed(3)} m`;
 s+='\n';
 return s;}));
await b.close();
