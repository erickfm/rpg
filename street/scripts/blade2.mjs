import { chromium } from 'playwright';
const look=(x,z,tx,tz)=>Math.atan2(tx-x,-(tz-z));
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1000,height:900}});
await p.goto('http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.clock(13,0)); await p.waitForTimeout(800);
const S=[
  ['orpheus-E', 47.5, -99.3, look(47.5,-99.3, 40.6,-97.2), 0.42],
  ['orpheus-W', 33.5, -99.3, look(33.5,-99.3, 40.6,-97.2), 0.42],
  ['aces-E',    57.0, -99.6, look(57.0,-99.6, 51.2,-97.2), 0.42],
  ['aces-W',    45.0, -99.6, look(45.0,-99.6, 51.2,-97.2), 0.42],
];
for(const [l,x,z,yaw,pitch] of S){
  await p.evaluate(([x,z,yaw,pitch])=>window.__ct.warp(x,z,yaw,0.14,pitch),[x,z,yaw,pitch]);
  await p.waitForTimeout(300); await p.screenshot({path:`shots/b2-${l}.png`});
}
await b.close(); console.log('ok');
