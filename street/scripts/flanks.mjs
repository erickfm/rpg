import { chromium } from 'playwright';
const look=(x,z,tx,tz)=>Math.atan2(tx-x,-(tz-z));
const S=[
  ['F1-east-join',  -1.5, -65,  look(-1.5,-65, 7,-65),   0, 0.45],
  ['F2-east-join2', -2.0, -9,   look(-2.0,-9, 7,-9),     0, 0.60],
  ['F3-west-join',   1.5, -82,  look(1.5,-82, -7,-82),   0, 0.45],
  ['F4-roofline',    0,   -30,  look(0,-30, 7,-30),      0, 1.00],
  ['F5-library',     2.0, -13,  look(2.0,-13, -7,-13),   0, 0.55],
];
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1400,height:900}});
await p.goto('http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.clock(13,0)); await p.waitForTimeout(800);
for(const [l,x,z,yaw,gy,pitch] of S){
  await p.evaluate(([x,z,yaw,gy,pitch])=>window.__ct.warp(x,z,yaw,gy,pitch),[x,z,yaw,gy,pitch]);
  await p.waitForTimeout(250); await p.screenshot({path:`shots/fl-${l}.png`});
}
await b.close(); console.log('ok');
