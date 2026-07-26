import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto('http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
console.log(await p.evaluate(()=>{const rows=[];
 window.__ct.scene().traverse(o=>{ if(!o.isMesh||!o.geometry?.attributes?.position)return;
  const m=o.matrixWorld.elements, pos=o.geometry.attributes.position, V=[];
  let xs=[1e9,-1e9],ys=[1e9,-1e9],zs=[1e9,-1e9];
  for(let i=0;i<pos.count;i++){ const X=pos.getX(i),Y=pos.getY(i),Z=pos.getZ(i);
   const wx=m[0]*X+m[4]*Y+m[8]*Z+m[12], wy=m[1]*X+m[5]*Y+m[9]*Z+m[13], wz=m[2]*X+m[6]*Y+m[10]*Z+m[14];
   V.push([wx,wy,wz]);
   if(wx<xs[0])xs[0]=wx; if(wx>xs[1])xs[1]=wx; if(wy<ys[0])ys[0]=wy; if(wy>ys[1])ys[1]=wy;
   if(wz<zs[0])zs[0]=wz; if(wz>zs[1])zs[1]=wz;}
  const cx=(xs[0]+xs[1])/2, cz=(zs[0]+zs[1])/2;
  if(cx<5.5||cx>18||cz<-98||cz>-92) return;
  if(ys[1]<2.0||ys[0]>4.5) return;
  const dx=xs[1]-xs[0], dz=zs[1]-zs[0], dy=ys[1]-ys[0];
  if(Math.max(dx,dz)<1.0) return;
  // slope of the TOP face along the projecting axis
  const cut=ys[0]+0.6*dy, top=V.filter(v=>v[1]>=cut);
  const ax = dz>=dx?2:0;                       // projecting axis is the SHORT one
  const proj = dz>=dx?dx:dz;
  let note='';
  if(top.length>2 && proj>0.15){
   const projAx = dz>=dx?0:2;
   const lo=Math.min(...top.map(v=>v[projAx])), hi=Math.max(...top.map(v=>v[projAx]));
   const yAt=(t)=>{const a=top.filter(v=>Math.abs(v[projAx]-t)<1e-3).map(v=>v[1]); return a.reduce((p,c)=>p+c,0)/a.length;};
   note=`  topface y@${lo.toFixed(2)}=${yAt(lo).toFixed(3)}  y@${hi.toFixed(2)}=${yAt(hi).toFixed(3)}`;}
  rows.push(`x ${xs[0].toFixed(2)}..${xs[1].toFixed(2)} (${dx.toFixed(2)})  y ${ys[0].toFixed(2)}..${ys[1].toFixed(2)} (${dy.toFixed(2)})  z ${zs[0].toFixed(2)}..${zs[1].toFixed(2)} (${dz.toFixed(2)})${note}`);});
 return rows.slice(0,22).join('\n')||'nothing';}));
await b.close();
