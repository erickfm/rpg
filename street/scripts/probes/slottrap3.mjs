// After Escape the overlay is opacity 0 but still display:block, visible, and
// full-viewport - and the player walks 0.00 m. Before filing: is that the
// overlay swallowing input, or merely my harness losing canvas focus? I made
// exactly that mistake on the jail door and nearly filed it against a new
// builder.
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1000,height:640}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:20000});
await afterFrames(p,10); await p.waitForTimeout(1200);
const pos=()=>p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
const walk=async(tag)=>{ const a=await pos();
  for(let i=0;i<10;i++){ await p.keyboard.down('w'); await p.waitForTimeout(120); await p.keyboard.up('w'); }
  await afterFrames(p,4); const c=await pos();
  const d=Math.hypot(c[0]-a[0],c[2]-a[2]);
  console.log(`   ${tag.padEnd(34)} walked ${d.toFixed(2)} m`); return d; };
// CONTROL: walking works at all before any of this
await p.evaluate(()=>window.__ct.warp(675,11.0,0,window.__ct.groundAt(675,11.0),0));
await afterFrames(p,6); await p.mouse.click(500,300); await p.waitForTimeout(250);
const ctrl=await walk('CONTROL, never sat down:');
const s=(await p.evaluate(()=>(window.__ct.seats?.()||[]).filter(q=>/slot/i.test(q.label||'')&&q.at)[0]));
await p.evaluate(([x,z])=>window.__ct.warp(x,z,0,window.__ct.groundAt(x,z),0),[s.at.x,s.at.z]);
await afterFrames(p,6); await p.waitForTimeout(300);
await p.keyboard.press('e'); await afterFrames(p,10); await p.waitForTimeout(700);
await p.keyboard.press('Escape'); await afterFrames(p,10); await p.waitForTimeout(700);
const noclick=await walk('after ESC, no click:');
await p.mouse.click(500,300); await p.waitForTimeout(300);
const withclick=await walk('after ESC, canvas clicked:');
const el=await p.evaluate(()=>{ const e=document.elementFromPoint(500,300); return e? (e.id||e.tagName) : null; });
console.log(`\n   what is under the cursor at (500,300): ${el}`);
console.log(`   ${ctrl>1 && withclick<0.5 ? '** REAL TRAP — walking works before, and not after, even with a click'
             : ctrl>1 && noclick<0.5 && withclick>1 ? 'focus only: a click frees the player'
             : 'inconclusive'}`);
await b.close();
