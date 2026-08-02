// Stand in room 301 and look all four ways. Last time I derived the window's
// position from the light well's coordinates and put myself in a wall four
// times; the room's own spots say it is x 196-202, z -20..-14 and the well I
// measured is at z -10.5, which is not even adjacent.
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(2000);
const [X,Z]=(process.env.AT??'198.6,-16.3').split(',').map(Number);
for(const [n,yaw] of [['E',Math.PI/2],['S',Math.PI],['W',-Math.PI/2],['N',0]]){
 await p.evaluate(([x,z,y])=>window.__ct.warp(x,z,y,window.__ct.pos()[3],0),[X,Z,yaw]);
 await afterFrames(p,4);
 const g=await p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
 await p.screenshot({path:`shots/r301-${n}.png`});
 console.log(`  r301-${n}.png at (${g[0]}, ${g[2]}) ground ${g[3]}`);
}
await b.close();
