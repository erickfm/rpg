import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto('http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(1500);
const r=await p.evaluate(()=>{
 const wbox=(o)=>{o.geometry.computeBoundingBox();const bb=o.geometry.boundingBox,e=o.matrixWorld.elements;
  let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  for(const X of [bb.min.x,bb.max.x])for(const Y of [bb.min.y,bb.max.y])for(const Z of [bb.min.z,bb.max.z]){
   const v=[e[0]*X+e[4]*Y+e[8]*Z+e[12],e[1]*X+e[5]*Y+e[9]*Z+e[13],e[2]*X+e[6]*Y+e[10]*Z+e[14]];
   for(let i=0;i<3;i++){if(v[i]<mn[i])mn[i]=v[i];if(v[i]>mx[i])mx[i]=v[i];}}
  return {mn,mx};};
 const parts=[],hex=(m)=>m?.color?'#'+m.color.getHexString():null;
 let wallHex=null, wallD=1e9;
 window.__ct.scene().traverse(o=>{if(!o.isMesh)return;
  const a=o.userData?.atmPart;
  if(a){const {mn,mx}=wbox(o);
   parts.push({a,tilt:o.userData.atmTilt,x:[+mn[0].toFixed(3),+mx[0].toFixed(3)],y:[+mn[1].toFixed(3),+mx[1].toFixed(3)],
    col:Array.isArray(o.material)?o.material.map(hex):hex(o.material)});return;}
  // nearest big wall plane to the ATM, for the tonal separation
  const {mn,mx}=wbox(o); if((mx[1]-mn[1])<2||(mx[0]-mn[0])>0.6)return;
  const d=Math.abs((mn[0]+mx[0])/2 +7.05)+Math.abs((mn[2]+mx[2])/2 -7.29);
  if(d<wallD&&mn[1]<1.5&&mx[1]>2){wallD=d;wallHex=hex(Array.isArray(o.material)?o.material[0]:o.material);}});
 return {parts,wallHex,wallD:+wallD.toFixed(2)};});
const lum=h=>h?Math.round(0.299*parseInt(h.slice(1,3),16)+0.587*parseInt(h.slice(3,5),16)+0.114*parseInt(h.slice(5,7),16)):null;
console.log(`parts: ${r.parts.length}`);
let lo=1e9,hi=-1e9,zlo=1e9,zhi=-1e9;
for(const q of r.parts){lo=Math.min(lo,q.y[0]);hi=Math.max(hi,q.y[1]);
 console.log(`  ${String(q.a).padEnd(8)} y ${q.y[0]}..${q.y[1]}  x ${q.x[0]}..${q.x[1]}  tilt ${q.tilt??'-'}  ${JSON.stringify(q.col)}`);}
console.log(`\nFASCIA: bottom ${lo.toFixed(3)}  top ${hi.toFixed(3)}  HEIGHT ${(hi-lo).toFixed(3)} m  (walk is 0.140, so ${(lo-0.14).toFixed(3)}..${(hi-0.14).toFixed(3)} above the pavement)`);
const body=r.parts.map(q=>Array.isArray(q.col)?q.col:[q.col]).flat().filter(Boolean);
const bl=body.map(lum).filter(Number.isFinite);
console.log(`wall nearest the ATM: ${r.wallHex} lum ${lum(r.wallHex)} (dist ${r.wallD})`);
console.log(`ATM part tones: ${[...new Set(body)].join(' ')}`);
if(bl.length&&r.wallHex){const w=lum(r.wallHex),d=bl.map(v=>Math.abs(v-w));
 console.log(`separation from the wall: min ${Math.min(...d)} max ${Math.max(...d)} levels  (${(100*Math.max(...d)/255).toFixed(0)}% at best)`);}
await b.close();
