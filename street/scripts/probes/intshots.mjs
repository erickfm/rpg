import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const look=(x,z,tx,tz)=>Math.atan2(tx-x,-(tz-z));
// diner slab0 cx=440 cz=0 (8.6x7.0 h3.0) · burger slab1 cx=520 cz=0 (11.0x8.5 h3.2)
const S=[
  ['R-diner-in',    440, 2.0,  Math.PI, 0, 0.05],
  ['R-diner-back',  440, -2.0, 0,       0, 0.10],
  ['R-diner-up',    440, 0,    0,       0, 1.10],
  ['R-burger-in',   520, 3.0,  Math.PI, 0, 0.05],
  ['R-burger-back', 520, -3.0, 0,       0, 0.10],
  ['R-burger-up',   520, 0,    0,       0, 1.10],
  ['R-burger-door', 520-3.6, 2.8, Math.PI, 0, 0.05],
  ['R-diner-door',  440-2.6, 2.2, Math.PI, 0, 0.05],
];
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1400,height:900}});
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await reportWorld(p, process.env.SHOT_URL ?? 'http://localhost:4184/');   // GOTCHAS 26
await p.evaluate(()=>window.__ct.clock(13,0)); await p.waitForTimeout(800);
for(const [l,x,z,yaw,gy,pitch] of S){
  await p.evaluate(([x,z,yaw,gy,pitch])=>window.__ct.warp(x,z,yaw,gy,pitch),[x,z,yaw,gy,pitch]);
  await p.waitForTimeout(250); await p.screenshot({path:`shots/int2-${l}.png`});
}
await b.close(); console.log('ok');
