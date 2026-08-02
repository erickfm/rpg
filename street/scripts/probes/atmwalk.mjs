// The ATM, from where a player actually is. NOT square-on at a chosen distance:
// that is how I wrongly confirmed attempt 3 and the user overturned me.
// Walk the pavement past it looking AHEAD, then stop where you would use it.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(-5.6,12,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(2000);
await setClock(p,13);
// where IS the walk here?
const prof=await p.evaluate(()=>{const o=[];for(let x=-3;x>=-8;x-=0.2)o.push([+x.toFixed(1),+window.__ct.groundAt(x,7.29).toFixed(3)]);return o;});
console.log('ground across the walk at z 7.29:'); console.log('  '+prof.map(([x,y])=>`${x}:${y}`).join(' '));
const walk=prof.filter(([x,y])=>y>0.1); const WX=walk.length?walk[Math.floor(walk.length/2)][0]:-5.6;
console.log(`walk band x ${walk.length?walk[0][0]:'?'} .. ${walk.length?walk[walk.length-1][0]:'?'}, standing at x ${WX}`);
const shots=[
  // walking north->south along the walk, LOOKING AHEAD. ATM is off to the side.
  ['pass-6m',  WX, 13.3, 0,          -0.05],
  ['pass-3m',  WX, 10.3, 0,          -0.05],
  ['pass-1m',  WX,  8.3, 0,          -0.05],
  ['pass-by',  WX,  7.29, 0,         -0.05],   // level with it, still looking ahead
  // the glance: level with it, head turned to the wall
  ['glance',   WX,  7.29, -Math.PI/2,-0.08],
  // the stop-and-use position, from the walk, not from a distance I picked
  ['use',      -6.15, 7.29, -Math.PI/2, -0.14],
];
for(const [n,x,z,yaw,pi] of shots){
  await p.evaluate(([x,z,y,g,pi])=>window.__ct.warp(x,z,y,g,pi),[x,z,yaw,0.14,pi]);
  await afterFrames(p,3); await p.screenshot({path:`shots/aw-${n}.png`}); console.log(`  aw-${n}.png  (${x}, ${z}) yaw ${yaw.toFixed(2)}`);
}
await b.close();
