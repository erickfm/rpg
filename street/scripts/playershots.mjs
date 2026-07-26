import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const look=(x,z,tx,tz)=>Math.atan2(tx-x,-(tz-z));
const S=[
  // blade signs, both directions along the side street
  ['P1-blade-from-west',  30, -100, look(30,-100, 44.4,-96.8), 0, 0.45],
  ['P2-blade-from-east',  56, -100, look(56,-100, 44.4,-96.8), 0, 0.45],
  ['P3-aces-from-west',   30, -101, look(30,-101, 51.2,-95),   0, 0.60],
  ['P4-aces-from-east',   56.5,-101, look(56.5,-101, 51.2,-95), 0, 0.60],
  // park: day and night, and life
  ['P5-park-day',        -3, -76,  look(-3,-76, -12,-80),      0, 0.15],
  ['P6-park-night',      -3, -76,  look(-3,-76, -12,-80),      0, 0.15, [22,30]],
  ['P7-park-in',        -12, -78,  look(-12,-78, -12,-88),     0, 0.10],
  // car lot: from the street and from inside
  ['P8-lot-street',       2, -30,  look(2,-30, 12,-30),        0, 0.20],
  ['P9-lot-inside',      14, -30,  look(14,-30, 28,-30),       0, 0.10],
  // bench ad + legs
  ['P10-bench',          -4.4,-36.6, look(-4.4,-36.6, -6.2,-36.6), 0, -0.10],
  ['P11-bench-legs',     -5.2,-36.6, look(-5.2,-36.6, -6.4,-36.6), 0, -0.45],
  // wheel arches
  ['P12-car',             2.6,-13,  look(2.6,-13, 3.9,-13),    0, -0.12],
  // puddles / gutter
  ['P13-gutter',          4.2,-46,  look(4.2,-46, 5.0,-49),    0, -0.55],
  // interior people
  // WAS (600, 1.2) facing Math.PI — that is the CASINO (cx 600), not the diner
  // (cx 760), so this station never photographed the room its name claims. And
  // re-aiming it at the diner was not enough: the diner's figures stand at
  // z 2.02 and the camera faced -z, away from them. A station named for a thing
  // has to FRAME the thing. Now stood south of them, looking north.
  ['P14-diner-keeper',  760, -1.0, look(760,-1.0, 761.8, 2.02), 0, 0.02],
  ['P15-lot-office',     26, -30,  look(26,-30, 30,-30),       0, 0.05],
];
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1200,height:800}});
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await reportWorld(p, process.env.SHOT_URL ?? 'http://localhost:4184/');   // GOTCHAS 26
await p.evaluate(()=>window.__ct.clock(13,0)); await p.waitForTimeout(800);
for(const [l,x,z,yaw,gy,pitch,hm] of S){
  // gy from the world, not a literal 0: every station passed 0 and the pavement
  // is 0.14, so each of these was shot 14 cm into the ground it stands on.
  await p.evaluate(([x,z,yaw,pitch,hm])=>{ if(hm) window.__ct.clock(hm[0],hm[1]);
    window.__ct.warp(x,z,yaw,window.__ct.groundAt(x,z),pitch); },[x,z,yaw,pitch,hm??null]);
  await p.waitForTimeout(hm?900:280);
  const at=await p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
  if(Math.hypot(at[0]-x,at[2]-z)>0.9) console.log(`  ** ${l}: asked (${x}, ${z}), landed (${at[0]}, ${at[2]})`);
  await p.screenshot({path:`shots/pl-${l}.png`});
  if(hm) await p.evaluate(()=>window.__ct.clock(13,0));
}
await b.close(); console.log('ok');
