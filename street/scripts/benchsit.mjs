// "no way to sit at the bench from the street cause the e option doesnt come up"
// End to end: warp, press E, read seated(). Map WHERE it fires, rather than
// checking the one spot the builder chose.
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(5.9,-35,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(2000);
await p.locator('canvas').first().click({position:{x:640,y:400}}).catch(()=>{});
const seats=await p.evaluate(()=>{try{return window.__ct.seats();}catch(e){return String(e);}});
console.log('seats near the bench:', JSON.stringify(seats).slice(0,400));
const BX=5.32, BZ=-35.45;
console.log(`\nbench seat at (${BX}, ${BZ}).  map of where [E] fires:\n`);
const rows=[];
for(let x=3.6;x<=7.4;x+=0.4){
 let line=`x ${x.toFixed(1)}  `;
 for(let z=BZ-2.4;z<=BZ+2.4;z+=0.6){
  const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[x,z]);
  await p.evaluate(([x,z,g])=>window.__ct.warp(x,z,-Math.PI/2,g,0),[x,z,gy]);
  await afterFrames(p,2);
  const pos=await p.evaluate(()=>window.__ct.pos());
  const landed=Math.hypot(pos[0]-x,pos[2]-z)<0.4;
  await p.keyboard.press('KeyE'); await afterFrames(p,2);
  const st=await p.evaluate(()=>{try{return window.__ct.seated?.();}catch(e){return null;}});
  const sat=!!(st&&typeof st==='object');
  if(sat) await p.evaluate(()=>{try{window.__ct.stand();}catch(e){}});
  line += !landed ? ' · ' : (sat?' E ':' . ');
  rows.push({x:+x.toFixed(1),z:+z.toFixed(1),landed,sat,gy});
 }
 console.log(line);
}
console.log(`\nkey:  E = pressing E seated the player   . = stood there, no prompt   · = could not stand there`);
const zs=[]; for(let z=BZ-2.4;z<=BZ+2.4;z+=0.6) zs.push(z.toFixed(1));
console.log(`columns are z = ${zs.join('  ')}`);
const fired=rows.filter(o=>o.sat), stood=rows.filter(o=>o.landed);
console.log(`\n${fired.length} of ${stood.length} standable positions seat the player`);
if(fired.length){ const xs=fired.map(o=>o.x);
 console.log(`fires from x ${Math.min(...xs)} to ${Math.max(...xs)}   (kerb at 5.25, walk 5.25..7.25)`);}
const road=rows.filter(o=>o.x<5.25);
console.log(`roadway side (x<5.25): ${road.filter(o=>o.landed).length} of ${road.length} standable, ${road.filter(o=>o.sat).length} seat`);
await b.close();
