import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{
 const rd=window.__ct.roomDims, out={typeofRoomDims:typeof rd};
 out.roomDimsSample = typeof rd==='function' ? JSON.stringify(rd('diner')) : JSON.stringify(rd);
 out.modules = typeof window.__ct.modules==='function'?JSON.stringify(window.__ct.modules()).slice(0,300):String(window.__ct.modules).slice(0,300);
 // which userData keys exist anywhere?
 const keys=new Set(); let n=0;
 window.__ct.scene().traverse(o=>{n++; for(const k of Object.keys(o.userData||{})) keys.add(k);});
 out.meshes=n; out.udKeys=[...keys].sort().join(' ');
 // spread of x, to find the interior belt
 const xs=[]; window.__ct.scene().traverse(o=>{ if(!o.isMesh)return; const e=o.matrixWorld.elements; xs.push(e[12]);});
 xs.sort((a,b)=>a-b);
 out.xrange=[xs[0]?.toFixed(0), xs[Math.floor(xs.length*0.5)]?.toFixed(0), xs[xs.length-1]?.toFixed(0)];
 out.far = xs.filter(v=>v>200).length;
 return out;});
console.log(JSON.stringify(r,null,1).slice(0,1800));
await b.close();
