// The bodega awning sits on the 45-degree CHAMFER, so "outward" is neither x nor
// z: doors() gives the normal (-0.7071, -0.7071). Project every top-face vertex
// onto that normal and fit y against it. An awning sheds water, so y must FALL
// as you go outward.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
console.log(await p.evaluate(()=>{
 const d=window.__ct.doors().find(q=>q.building==='BODEGA');
 const nx=d.point.nx, nz=d.point.nz; let s=`BODEGA door normal (${nx.toFixed(4)}, ${nz.toFixed(4)}) — outward\n`;
 window.__ct.scene().traverse(o=>{ if(!o.isMesh||!o.geometry?.attributes?.position)return;
  const m=o.matrixWorld.elements, pos=o.geometry.attributes.position, V=[];
  let xs=[1e9,-1e9],ys=[1e9,-1e9],zs=[1e9,-1e9];
  for(let i=0;i<pos.count;i++){ const X=pos.getX(i),Y=pos.getY(i),Z=pos.getZ(i);
   const wx=m[0]*X+m[4]*Y+m[8]*Z+m[12], wy=m[1]*X+m[5]*Y+m[9]*Z+m[13], wz=m[2]*X+m[6]*Y+m[10]*Z+m[14];
   V.push([wx,wy,wz]);
   if(wx<xs[0])xs[0]=wx; if(wx>xs[1])xs[1]=wx; if(wy<ys[0])ys[0]=wy; if(wy>ys[1])ys[1]=wy;
   if(wz<zs[0])zs[0]=wz; if(wz>zs[1])zs[1]=wz;}
  const cx=(xs[0]+xs[1])/2, cz=(zs[0]+zs[1])/2;
  if(cx<6||cx>10||cz<-97||cz>-93) return;
  if(ys[0]<2.0||ys[1]>4.0) return;
  const dy=ys[1]-ys[0]; const cut=ys[0]+0.6*dy;
  const top=V.filter(v=>v[1]>=cut); if(top.length<3) return;
  const sOf=(v)=>v[0]*nx + v[2]*nz;                      // outward coordinate
  const ss=top.map(sOf), lo=Math.min(...ss), hi=Math.max(...ss);
  if(hi-lo<0.15) return;                                  // must actually project
  const yAt=(t)=>{const a=top.filter(v=>Math.abs(sOf(v)-t)<1e-3).map(v=>v[1]); return a.reduce((p,c)=>p+c,0)/a.length;};
  const yIn=yAt(lo), yOut=yAt(hi), drop=(yIn-yOut)*1000;
  s+=`\nmesh x ${xs[0].toFixed(2)}..${xs[1].toFixed(2)}  y ${ys[0].toFixed(3)}..${ys[1].toFixed(3)}  z ${zs[0].toFixed(2)}..${zs[1].toFixed(2)}\n`+
     `   projects ${(hi-lo).toFixed(3)} m along the outward normal\n`+
     `   TOP FACE  wall end y ${yIn.toFixed(3)}   OUTER end y ${yOut.toFixed(3)}\n`+
     `   -> ${Math.abs(drop)<2?'LEVEL':(drop>0?`outer edge LOWER by ${drop.toFixed(0)} mm — sheds outward, CORRECT`:`outer edge HIGHER by ${(-drop).toFixed(0)} mm — TILTS UP, the reported fault`)}\n`;});
 return s;}));
await b.close();
