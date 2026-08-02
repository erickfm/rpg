import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
const look=(x,z,tx,tz)=>Math.atan2(tx-x,-(tz-z));
const S=[
  ['W1-bodega-arris',   6.0, -99.0, look(6.0,-99.0, 9,-96),      0, 0.35],
  ['W1-bodega-arris-up',6.0, -99.0, look(6.0,-99.0, 9,-96),      0, 0.85],
  ['W2-east-cross',    52.0, -101,  look(52.0,-101, 57,-96),     0, 0.35],
  ['W3-alley-arris',   -4.0, -34.0, look(-4.0,-34.0, -7,-37),    0, 0.35],
  ['W3-alley-in',      -9.5, -40.2, look(-9.5,-40.2, -13.6,-40.2), 0, 0.10],
  ['W4-library',        2.0, -13,   look(2.0,-13, -7,-13),       0, 0.40],
  ['W4-lib-meridian',   2.0, -5,    look(2.0,-5, -7,-5),         0, 0.40],
  ['W5-burger-band',    3.0, -29,   look(3.0,-29, -7,-29),       0, 0.30],
  ['W6-endcap',        -1.5, -65,   look(-1.5,-65, 7,-65),       0, 0.35],
  ['W6-endcap-2',      -2.0, -9,    look(-2.0,-9, 7,-9),         0, 0.55],
];
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1400,height:900}});
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await reportWorld(p, process.env.SHOT_URL ?? 'http://localhost:4184/');   // GOTCHAS 26
await p.evaluate(()=>window.__ct.clock(13,0)); await p.waitForTimeout(800);
for(const [l,x,z,yaw,gy,pitch] of S){
  await p.evaluate(([x,z,yaw,gy,pitch])=>window.__ct.warp(x,z,yaw,gy,pitch),[x,z,yaw,gy,pitch]);
  await p.waitForTimeout(250); await p.screenshot({path:`shots/rv2-${l}.png`});
}
await b.close(); console.log('ok');
