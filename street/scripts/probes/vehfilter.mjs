// "textures on back of truck are janky" - mipmaps on a vehicle crawl into a
// checkerboard at grazing angles. H: 69 car + 14 bus textures, ZERO mipmapped.
// THREE: NearestFilter 1003, NearestMipmapNearest 1004, LinearMipmapLinear 1008.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{
 const NAMES={1003:'Nearest',1004:'NearestMipmapNearest',1005:'NearestMipmapLinear',
              1006:'Linear',1007:'LinearMipmapNearest',1008:'LinearMipmapLinear'};
 const seen=new Set(); const cars=[], bus=[];
 window.__ct.scene().traverse(g=>{
  const wb=g.userData?.wheelbase; if(wb===undefined) return;
  const isBus=Math.abs(wb-5.5)<0.01;
  g.traverse(o=>{ if(!o.isMesh) return;
   const mats=Array.isArray(o.material)?o.material:[o.material];
   for(const m of mats){ const t=m?.map; if(!t||seen.has(t)) continue; seen.add(t);
    const rec={f:t.minFilter, name:NAMES[t.minFilter]||String(t.minFilter), mips:!!t.generateMipmaps};
    (isBus?bus:cars).push(rec); } });
 });
 const tally=(a)=>{const o={}; for(const q of a) o[q.name]=(o[q.name]||0)+1; return o;};
 const mipped=(a)=>a.filter(q=>q.f===1004||q.f===1005||q.f===1007||q.f===1008).length;
 return {carN:cars.length, busN:bus.length, carT:tally(cars), busT:tally(bus),
   carMip:mipped(cars), busMip:mipped(bus),
   carGen:cars.filter(q=>q.mips).length, busGen:bus.filter(q=>q.mips).length};});
console.log(`car textures ${r.carN}   (H says 69)`);
console.log(`   minFilter: ${JSON.stringify(r.carT)}`);
console.log(`   still MIPMAPPED: ${r.carMip}    generateMipmaps still true on: ${r.carGen}`);
console.log(`\nbus textures ${r.busN}   (H says 14)`);
console.log(`   minFilter: ${JSON.stringify(r.busT)}`);
console.log(`   still MIPMAPPED: ${r.busMip}    generateMipmaps still true on: ${r.busGen}`);
console.log(`\nverdict: ${r.carMip+r.busMip===0?'ZERO vehicle textures are mipmapped':'** '+(r.carMip+r.busMip)+' vehicle textures still mipmapped'}`);
await b.close();
