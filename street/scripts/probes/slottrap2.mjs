// Escape now un-seats you but #ct-panelback is still in the DOM. Present is not
// the same as VISIBLE, and "can you leave" is a question about moving, not about
// an element. Check visibility and then try to walk away.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1000,height:640}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:20000});
await afterFrames(p,10); await p.waitForTimeout(1200);
const pos=()=>p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
const panelInfo=()=>p.evaluate(()=>{ const e=document.querySelector('#ct-panelback');
  if(!e) return {present:false};
  const cs=getComputedStyle(e); const r=e.getBoundingClientRect();
  return {present:true, display:cs.display, visibility:cs.visibility, opacity:cs.opacity,
          w:Math.round(r.width), h:Math.round(r.height)}; });
const s=(await p.evaluate(()=>(window.__ct.seats?.()||[]).filter(q=>/slot/i.test(q.label||'')&&q.at)[0]));
await p.evaluate(([x,z])=>window.__ct.warp(x,z,0,window.__ct.groundAt(x,z),0),[s.at.x,s.at.z]);
await afterFrames(p,6); await p.mouse.click(500,300); await p.waitForTimeout(250);
await p.keyboard.press('e'); await afterFrames(p,10); await p.waitForTimeout(700);
console.log(`\nseated, panel open: ${JSON.stringify(await panelInfo())}`);
await p.keyboard.press('Escape'); await afterFrames(p,10); await p.waitForTimeout(700);
console.log(`after ESC:          ${JSON.stringify(await panelInfo())}`);
console.log(`  seated now: ${await p.evaluate(()=>window.__ct.seated())}`);
// the real question: can the player walk away?
const before=await pos();
for(let i=0;i<10;i++){ await p.keyboard.down('w'); await p.waitForTimeout(120); await p.keyboard.up('w'); }
await afterFrames(p,4);
const after=await pos();
const moved=Math.hypot(after[0]-before[0],after[2]-before[2]);
console.log(`\n  walked ${moved.toFixed(2)} m after Escape  (${before[0]}, ${before[2]}) -> (${after[0]}, ${after[2]})`);
await p.screenshot({path:'shots/slottrap2.png'});
console.log(`  ${moved>1.0 ? 'THE PLAYER CAN LEAVE — sit, Escape, walk away' : '** the player cannot walk away'}`);
await b.close();
