// My own oldest CONFIRMED rows rest on COUNTS owned by other agents' files.
// Re-measure each against what I originally recorded.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
console.log(await p.evaluate(()=>{
 const PARK={x0:-42,x1:-8,z0:-102,z1:-58};
 const inPark=(x,z)=>x>PARK.x0&&x<PARK.x1&&z>PARK.z0&&z<PARK.z1;
 let meshes=0, lamps=0;
 window.__ct.scene().traverse(o=>{ if(!o.isMesh)return;
  const e=o.matrixWorld.elements; if(!inPark(e[12],e[14])) return; meshes++;
  const u=o.userData||{}; if(u.parkLantern) lamps++; });
 // walkable extent of the park, as a disc
 const R=0.36, cols=window.__ct.colliders();
 const free=(x,z)=>!cols.some(c=>x>c.minX-R&&x<c.maxX+R&&z>c.minZ-R&&z<c.maxZ+R);
 let n=0,tot=0, minx=1e9,maxx=-1e9;
 for(let x=PARK.x0;x<=PARK.x1;x+=0.5) for(let z=PARK.z0;z<=PARK.z1;z+=0.5){
  const g=window.__ct.groundAt(x,z); if(!(g>-1&&g<5)) continue; tot++;
  if(free(x,z)){ n++; if(x<minx)minx=x; if(x>maxx)maxx=x; } }
 let s=`PARK NOT A YARD — I confirmed "42.5 m walkable, 569 meshes"\n`;
 s+=`   meshes in the park now: ${meshes}\n`;
 s+=`   walkable width now: ${(maxx-minx).toFixed(1)} m   (free cells ${n} of ${tot})\n`;
 s+=`\nPARK LIT — I confirmed "20 light sources, ten lanterns, three ranks"\n`;
 s+=`   objects tagged parkLantern now: ${lamps}\n`;
 // steps: the two I confirmed by ground height
 const lib=[window.__ct.groundAt(-10.5,-13).toFixed(2), window.__ct.groundAt(-8.0,-13).toFixed(2)];
 const ch =[window.__ct.groundAt(8.85,-79.5).toFixed(2), window.__ct.groundAt(9.6,-79.5).toFixed(2)];
 s+=`\nSTEPS — I confirmed library gy 0.42 -> 0.99, church gy 0.31 -> 0.51\n`;
 s+=`   library forecourt now: ${lib.join(' -> ')}\n`;
 s+=`   church approach now:   ${ch.join(' -> ')}\n`;
 // seats on the library frontage
 const seats=(window.__ct.seats?window.__ct.seats():[]);
 const court=seats.filter(q=>q.pose&&q.pose.x>-16&&q.pose.x<-6&&q.pose.z>-20&&q.pose.z<-6);
 s+=`\nCOURTYARD BENCHES — I confirmed "[E] sit on the frontage"\n`;
 s+=`   seats registered near the library courtyard now: ${court.length} of ${seats.length} world-wide\n`;
 return s;}));
await b.close();
