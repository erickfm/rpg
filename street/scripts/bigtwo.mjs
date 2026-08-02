import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
console.log(await p.evaluate(()=>{
 const cols=window.__ct.colliders(), dims=window.__ct.roomDims(); let s='';
 // the casino and library EXTERIOR footprints: biggest collider near each door
 for(const [name,dx,dz] of [['SEVENS (casino)',51.29,-96],['LIBRARY',null,null],['ST BRIGID (church)',9.6,-79.5],['HOTEL ORPHEUS',null,null]]){
  const d=window.__ct.doors().find(q=>q.building.startsWith(name.split(' ')[0]));
  if(!d){s+=`${name}: no published door\n`;continue;}
  const px=d.point.x-d.point.nx*0.6, pz=d.point.z-d.point.nz*0.6;
  const hosts=cols.filter(c=>px>c.minX&&px<c.maxX&&pz>c.minZ&&pz<c.maxZ)
    .sort((a,c)=>((c.maxX-c.minX)*(c.maxZ-c.minZ))-((a.maxX-a.minX)*(a.maxZ-a.minZ)));
  const h=hosts[0];
  const id={'SEVENS':'casino','LIBRARY':'library','ST':'church','HOTEL':'hotel'}[name.split(' ')[0]];
  const rm=dims.find(q=>q.id===id);
  s+=`${name}: door (${d.point.x.toFixed(1)}, ${d.point.z.toFixed(1)})  hosts ${hosts.length}\n`;
  if(h) s+=`   exterior footprint ${(h.maxX-h.minX).toFixed(2)} x ${(h.maxZ-h.minZ).toFixed(2)} = ${((h.maxX-h.minX)*(h.maxZ-h.minZ)).toFixed(0)} m2\n`;
  if(rm) s+=`   interior room      ${rm.w} x ${rm.d} = ${(rm.w*rm.d).toFixed(0)} m2`+
    (h?`   -> interior is ${((rm.w*rm.d)/((h.maxX-h.minX)*(h.maxZ-h.minZ))).toFixed(2)}x the footprint\n`:'\n');}
 return s;}));
await b.close();
