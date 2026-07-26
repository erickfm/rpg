// "a casino slot stool opens a modal and hud.ts BLOCKS keydown"
// PREDICATE (I's): warp to a slot stool's published `at`, press E to sit, press
// E, press Escape. seated() stays true through both and #ct-panelback is in the
// document => trapped.
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1000,height:640}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1200);
const seated=()=>p.evaluate(()=>{ try{ return !!window.__ct.seated(); }catch(e){ return null; } });
const panel=()=>p.evaluate(()=>!!document.querySelector('#ct-panelback'));
const pos=()=>p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
const prompt=()=>p.evaluate(()=>{const m=(document.body.innerText||'').match(/\[E\][^\n]*/);return m?m[0].trim():null;});
const slots=await p.evaluate(()=>(window.__ct.seats?.()||[])
  .filter(q=>/slot/i.test(q.label||'')&&q.at).map(q=>({x:q.at.x,z:q.at.z,l:q.label})));
console.log(`\nslot stools published: ${slots.length}`);
if(!slots.length){ console.error('CANNOT ANSWER — no slot seats published.'); process.exit(3); }
const s=slots[0];
await p.evaluate(([x,z])=>window.__ct.warp(x,z,0,window.__ct.groundAt(x,z),0),[s.x,s.z]);
await afterFrames(p,6); await p.waitForTimeout(400);
await p.mouse.click(500,300); await p.waitForTimeout(250);
console.log(`at the stool (${(await pos()).filter((_,i)=>i!==1).join(', ')})  prompt ${JSON.stringify(await prompt())}`);
await p.keyboard.press('e'); await afterFrames(p,10); await p.waitForTimeout(700);
console.log(`after E #1: seated=${await seated()}  panel=${await panel()}  prompt ${JSON.stringify(await prompt())}`);
await p.keyboard.press('e'); await afterFrames(p,10); await p.waitForTimeout(700);
console.log(`after E #2: seated=${await seated()}  panel=${await panel()}`);
await p.keyboard.press('Escape'); await afterFrames(p,10); await p.waitForTimeout(700);
const st=await seated(), pn=await panel(), q=await pos();
console.log(`after ESC : seated=${st}  panel=${pn}  at (${q[0]}, ${q[2]})`);
await p.screenshot({path:'shots/slottrap.png'});
console.log(`\n  ${st===false&&pn===false ? 'YOU CAN LEAVE — the trap is gone' : '** STILL TRAPPED: seated='+st+' panel='+pn}`);
await b.close();
