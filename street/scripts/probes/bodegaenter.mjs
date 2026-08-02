// "when i enter bodega i should be facing perpendicular to the wall door", and
// "bodega exit needs work". Both are behaviours, so both get walked: stand at
// the published door, press E, read where you came to rest and which way you
// face; then leave the same way.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1500);
await p.evaluate(()=>window.__ct.clock(13,0)); await afterFrames(p,4);
const door=await p.evaluate(()=>window.__ct.doors().find(d=>/BODEGA/i.test(d.building)));
const idoor=await p.evaluate(()=>window.__ct.roomDims().find(r=>r.id==='bodega'));
console.log(`street door  stand (${door.stand.x.toFixed(2)}, ${door.stand.z.toFixed(2)})  normal (${door.point.nx.toFixed(3)}, ${door.point.nz.toFixed(3)})  chamfer ${door.chamfer}`);
console.log(`interior     centre (${idoor.cx}, ${idoor.cz})  ${idoor.w} x ${idoor.d}  door normal (${idoor.door.nx.toFixed(3)}, ${idoor.door.nz.toFixed(3)})`);
// face the door before pressing E, as a player walking up to it would
// YAW, CHECKED AGAINST A KNOWN CASE rather than written from memory. The camera
// looks along (sin y, -cos y), so to look along (nx, nz) you need sin y = nx and
// cos y = -nz. My first version was atan2(-nx, nz), which points the OPPOSITE
// way and made a 45-degree difference read as 135. Sanity: (0,-1) must give 0.
const yawAt=(nx,nz)=>Math.atan2(nx,-nz);
if(Math.abs(yawAt(0,-1))>1e-9) throw new Error('yaw convention check failed');
await p.evaluate(([x,z,y])=>window.__ct.warp(x,z,y,window.__ct.groundAt(x,z),0),
  [door.stand.x,door.stand.z,yawAt(door.point.nx,door.point.nz)]);
await afterFrames(p,5);
const outside=await p.evaluate(()=>({pos:window.__ct.pos().map(v=>+v.toFixed(2)),yaw:+window.__ct.yaw().toFixed(3)}));
const promptBefore=await p.evaluate(()=>{const m=(document.body.innerText||'').match(/\[E\][^\n]*/);return m?m[0].trim():null;});
console.log(`\noutside: (${outside.pos[0]}, ${outside.pos[2]})  prompt ${JSON.stringify(promptBefore)}`);
await p.keyboard.press('e'); await afterFrames(p,10); await p.waitForTimeout(700);
const inside=await p.evaluate(()=>({pos:window.__ct.pos().map(v=>+v.toFixed(2)),yaw:+window.__ct.yaw().toFixed(3)}));
await p.screenshot({path:'shots/bod-arrive.png'});
const want=yawAt(idoor.door.nx,idoor.door.nz);
const norm=(a)=>{ while(a>Math.PI)a-=2*Math.PI; while(a<-Math.PI)a+=2*Math.PI; return a; };
const off=Math.abs(norm(inside.yaw-want))*180/Math.PI;
console.log(`inside : (${inside.pos[0]}, ${inside.pos[2]}) gy ${inside.pos[3]}  yaw ${inside.yaw}`);
console.log(`   the door's inward normal wants yaw ${want.toFixed(3)}; you face ${inside.yaw} — off by ${off.toFixed(1)}°`);
console.log(`   room centreline x ${idoor.cx}; you are at x ${inside.pos[0]}, ${Math.abs(inside.pos[0]-idoor.cx).toFixed(2)} m off it`);
console.log(`   ${off<20?'SQUARE to the door':'** NOT square to the door'}`);
// and back out
// LEAVING: a player would walk to the door, not press E where they landed.
const promptIn=await p.evaluate(()=>{const m=(document.body.innerText||'').match(/\[E\][^\n]*/);return m?m[0].trim():null;});
console.log(`\nprompt where you LAND: ${JSON.stringify(promptIn)}`);
const dx=(idoor.cx+idoor.door.x)-inside.pos[0], dz=(idoor.cz+idoor.door.z)-inside.pos[2];
await p.evaluate(([y])=>window.__ct.warp(window.__ct.pos()[0],window.__ct.pos()[2],y,window.__ct.pos()[3],0),
  [Math.atan2(dx,-dz)]);
await afterFrames(p,4);
for(let i=0;i<12;i++){ await p.keyboard.down('w'); await p.waitForTimeout(120); await p.keyboard.up('w'); }
await afterFrames(p,4);
const atDoor=await p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
const promptDoor=await p.evaluate(()=>{const m=(document.body.innerText||'').match(/\[E\][^\n]*/);return m?m[0].trim():null;});
console.log(`walked to the door: (${atDoor[0]}, ${atDoor[2]})  prompt ${JSON.stringify(promptDoor)}`);
await p.keyboard.press('e'); await afterFrames(p,10); await p.waitForTimeout(700);
const back=await p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
await p.screenshot({path:'shots/bod-exit.png'});
console.log(`back out: (${back[0]}, ${back[2]}) gy ${back[3]}   ${Math.abs(back[0])<60?'on the street':'** still inside'}`);
await b.close();
