// The user's park graphics review: walk the full depth and the loop, in
// daylight, at night, and in rain, and SHOOT what a player sees.
// Not a harness — the frames are the deliverable and I read every one.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { setClock } from './lib/clock.mjs';
import { afterFrames } from './lib/frames.mjs';
const U=process.env.SHOT_URL ?? 'http://localhost:4184/';
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(U,{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await reportWorld(p,U);
// WARM-UP. The first four frames of the previous run came back 100% one colour:
// the world had not rendered yet when the first condition shot. shotguard.mjs
// caught it, which is what it is for.
await p.evaluate(()=>window.__ct.warp(-22,-83,-1.57,0.4,-0.12));
await afterFrames(p,10);
await p.waitForTimeout(2500);
// eye height, looking slightly down, as a player walks
const VIEWS=[
  ['edge',  -8.4, -83.0,  -1.57, -0.10],   // just inside, looking WEST into the 32 m depth
  ['mid',  -22.0, -83.0,  -1.57, -0.12],   // mid-park on the loop
  ['far',  -36.0, -83.0,   1.57, -0.12],   // far end looking back EAST
  ['loop', -22.0, -72.0,   3.14, -0.15],   // on the loop looking SOUTH across the field
];
const HOURS=[['day',13],['night',23],['rain',14]];
for(const [cond,h] of HOURS){
  await setClock(p,h);
  if(cond==='rain') await p.waitForTimeout(16000);   // measured settle for the wet look
  for(const [name,x,z,yaw,pitch] of VIEWS){
    // warp(x, z, yaw, GY, pitch) — the 4th arg is the ground height, not 0.
    // Passing 0 in a park whose floor is 0.14-0.51 puts the camera UNDER the
    // ground plane and every frame comes back black. Ask the world instead.
    const gy = await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[x,z]);
    await p.evaluate(([x,z,y,g,pi])=>window.__ct.warp(x,z,y,g,pi),[x,z,yaw,gy,pitch]);
    await afterFrames(p,3);
    const at=await p.evaluate(()=>window.__ct.pos());
    const off=Math.hypot(at[0]-x,at[2]-z);
    await p.screenshot({path:`shots/pk-${cond}-${name}.png`});
    console.log(`  pk-${cond}-${name}.png   asked (${x},${z}) landed (${at[0].toFixed(1)},${at[2].toFixed(1)}) ${off<0.6?'ok':'SLID '+off.toFixed(2)}  gy ${at[3].toFixed(2)}`);
  }
}
await b.close();
