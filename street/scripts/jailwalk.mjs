// O's six stations, in the order a player meets them.
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1100,height:700}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1200);
await p.evaluate(()=>window.__ct.clock(13,0)); await afterFrames(p,5);
const pos=()=>p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
const prompt=()=>p.evaluate(()=>{const m=(document.body.innerText||'').match(/\[E\][^\n]*/);return m?m[0].trim():null;});
const rooms=await p.evaluate(()=>window.__ct.roomDims().map(r=>r.id).join(' '));
console.log(`rooms: ${rooms}`);
const jd=await p.evaluate(()=>window.__ct.doors().find(d=>/JAIL/i.test(d.building)));
console.log(`jail door: ${jd? `point (${jd.point.x}, ${jd.point.z}) stand (${jd.stand.x.toFixed(2)}, ${jd.stand.z.toFixed(2)})` : 'not published'}`);
const shot=async(n,x,z,yaw,pi)=>{
  await p.evaluate(([x,z,y,pi])=>window.__ct.warp(x,z,y,window.__ct.groundAt(x,z),pi),[x,z,yaw,pi]);
  await afterFrames(p,5);
  const g=await pos(); await p.screenshot({path:`shots/jail-${n}.png`});
  console.log(`  jail-${n}.png at (${g[0]}, ${g[2]})  ${Math.hypot(g[0]-x,g[2]-z)<1.0?'':'** PUSHED'}`);
};
// 1 — down the side street, facing east
await shot('1-street', 30,-103, Math.PI/2, 0.06);
// 2 — at its foot, looking up
await shot('2-foot', 54.5,-103, Math.PI/2, 0.55);
// 3 — at the door
if(jd){
  await p.evaluate(([x,z,y])=>window.__ct.warp(x,z,y,window.__ct.groundAt(x,z),0),
    [jd.stand.x,jd.stand.z,Math.atan2(-jd.point.nx,-(-jd.point.nz))]);
  await afterFrames(p,5);
  const pr=await prompt(); console.log(`\n  at the door: prompt ${JSON.stringify(pr)}`);
  await p.keyboard.press('e'); await afterFrames(p,12); await p.waitForTimeout(800);
  const inside=await pos(); console.log(`  after E: (${inside[0]}, ${inside[2]}) gy ${inside[3]}`);
  await p.screenshot({path:'shots/jail-3-inside.png'});
  // 4 — walk to the counter
  for(let i=0;i<10;i++){ await p.keyboard.down('w'); await p.waitForTimeout(130); await p.keyboard.up('w'); }
  await afterFrames(p,4);
  const c=await pos(); await p.screenshot({path:'shots/jail-4-counter.png'});
  console.log(`  walked to (${c[0]}, ${c[2]}) — jail-4-counter.png (is the sergeant looking at you?)`);
  // 5/6 — deeper, then look both ways at the cells
  for(let i=0;i<14;i++){ await p.keyboard.down('w'); await p.waitForTimeout(130); await p.keyboard.up('w'); }
  await afterFrames(p,4);
  const d=await pos(); await p.screenshot({path:'shots/jail-5-corridor.png'});
  console.log(`  corridor at (${d[0]}, ${d[2]}) — jail-5-corridor.png`);
  for(const [n,yaw] of [['6-left',-Math.PI/2],['6-right',Math.PI/2]]){
    await p.evaluate(([y])=>window.__ct.warp(window.__ct.pos()[0],window.__ct.pos()[2],y,window.__ct.pos()[3],0),[yaw]);
    await afterFrames(p,4); await p.screenshot({path:`shots/jail-${n}.png`});
    console.log(`  jail-${n}.png`);
  }
}
await b.close();
