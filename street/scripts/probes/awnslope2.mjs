// Find the awning properly (D says it projects ~0.45 m) and get the slope from
// the TOP-FACE vertices only — averaging a box's whole end face returns the
// midpoint and reads as level whichever way it tilts.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
console.log(await p.evaluate(()=>{let s='';
 window.__ct.scene().traverse(o=>{ if(!o.isMesh||!o.geometry?.attributes?.position)return;
  const m=o.matrixWorld.elements, pos=o.geometry.attributes.position, V=[];
  let xs=[1e9,-1e9], ys=[1e9,-1e9], zs=[1e9,-1e9];
  for(let i=0;i<pos.count;i++){ const X=pos.getX(i),Y=pos.getY(i),Z=pos.getZ(i);
   const wx=m[0]*X+m[4]*Y+m[8]*Z+m[12], wy=m[1]*X+m[5]*Y+m[9]*Z+m[13], wz=m[2]*X+m[6]*Y+m[10]*Z+m[14];
   V.push([wx,wy,wz]);
   if(wx<xs[0])xs[0]=wx; if(wx>xs[1])xs[1]=wx; if(wy<ys[0])ys[0]=wy; if(wy>ys[1])ys[1]=wy;
   if(wz<zs[0])zs[0]=wz; if(wz>zs[1])zs[1]=wz;}
  if(xs[0]<9.5||xs[1]>17.5) return;
  if(zs[0]<-97.2||zs[1]>-95.8) return;
  if(ys[0]<1.8||ys[1]>4.2) return;
  const zSpan=zs[1]-zs[0]; if(zSpan<0.18) return;          // must actually project
  // TOP face only: vertices in the upper 40% of this mesh's own y range
  const cut=ys[0]+0.6*(ys[1]-ys[0]);
  const top=V.filter(v=>v[1]>=cut);
  if(top.length<3) return;
  const zOut=Math.min(...top.map(v=>v[2])), zWall=Math.max(...top.map(v=>v[2]));
  const yAt=(zt)=>{const a=top.filter(v=>Math.abs(v[2]-zt)<1e-3).map(v=>v[1]); return a.reduce((p,c)=>p+c,0)/a.length;};
  const yo=yAt(zOut), yw=yAt(zWall);
  const drop=(yw-yo)*1000;
  s+=`mesh x ${xs[0].toFixed(2)}..${xs[1].toFixed(2)}  y ${ys[0].toFixed(3)}..${ys[1].toFixed(3)}  z ${zs[0].toFixed(3)}..${zs[1].toFixed(3)}  projects ${zSpan.toFixed(3)} m\n`+
     `   TOP FACE: outer end (z ${zOut.toFixed(3)}) y ${yo.toFixed(3)}   wall end (z ${zWall.toFixed(3)}) y ${yw.toFixed(3)}\n`+
     `   -> ${Math.abs(drop)<1?'LEVEL':(drop>0?`outer edge LOWER by ${drop.toFixed(0)} mm — sheds outward, CORRECT`:`outer edge HIGHER by ${(-drop).toFixed(0)} mm — TILTS UP, the reported fault`)}\n`;});
 return s||'no projecting awning-like mesh matched — CANNOT ANSWER';}));
await b.close();
