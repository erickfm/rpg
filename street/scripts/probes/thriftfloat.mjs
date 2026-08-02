import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const look=(x,z,tx,tz)=>Math.atan2(tx-x,-(tz-z));
const S=[
  ['T1-side',   604.6, -2.42, look(604.6,-2.42, 602.2,-2.42), 0, 0.05],
  ['T2-front',  602.2, -0.2,  look(602.2,-0.2, 602.2,-2.42),  0, 0.05],
  ['T3-low',    603.6, -2.42, look(603.6,-2.42, 602.2,-2.6),  0, -0.18],
  ['T4-aces',    51,   -101,  look(51,-101, 51,-95),          0, 0.85],
  ['T5-blade',   40,   -98.5, look(40,-98.5, 44.35,-96.7),    0, 0.62],
];
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1400,height:900}});
await p.goto(aim('http://localhost:4184/'), { waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await reportWorld(p, aim('http://localhost:4184/'));   // GOTCHAS 26
await p.evaluate(()=>window.__ct.clock(13,0)); await p.waitForTimeout(800);
for(const [l,x,z,yaw,gy,pitch] of S){
  await p.evaluate(([x,z,yaw,gy,pitch])=>window.__ct.warp(x,z,yaw,gy,pitch),[x,z,yaw,gy,pitch]);
  await p.waitForTimeout(250); await p.screenshot({path:`shots/tf-${l}.png`});
}
await b.close(); console.log('ok');
