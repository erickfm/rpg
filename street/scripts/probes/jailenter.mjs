// The door did not fire on my first attempt: the prompt was live but E left me
// on the street. Retry with the canvas focused and a longer settle - if it still
// does not fire that is a finding, and if it does the fault was mine.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1100,height:700}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1500);
await p.evaluate(()=>window.__ct.clock(13,0)); await afterFrames(p,5);
const pos=()=>p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
const prompt=()=>p.evaluate(()=>{const m=(document.body.innerText||'').match(/\[E\][^\n]*/);return m?m[0].trim():null;});
const jd=await p.evaluate(()=>window.__ct.doors().find(d=>/JAIL/i.test(d.building)));
await p.evaluate(([x,z,y])=>window.__ct.warp(x,z,y,window.__ct.groundAt(x,z),0),
  [jd.stand.x,jd.stand.z,Math.atan2(-jd.point.nx,-(-jd.point.nz))]);
await afterFrames(p,6); await p.waitForTimeout(500);
console.log(`at the door (${(await pos()).slice(0,3).join(', ')})  prompt ${JSON.stringify(await prompt())}`);
await p.mouse.click(550,350);                      // focus the canvas as a player would
await p.waitForTimeout(300);
for(const how of ['press','down-up']){
  const before=await pos();
  if(how==='press') await p.keyboard.press('e');
  else { await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e'); }
  await afterFrames(p,12); await p.waitForTimeout(900);
  const after=await pos();
  const moved=Math.hypot(after[0]-before[0],after[2]-before[2]);
  console.log(`  ${how}: (${before[0]}, ${before[2]}) -> (${after[0]}, ${after[2]}) gy ${after[3]}   moved ${moved.toFixed(2)} m  ${moved>3?'ENTERED':'no'}`);
  if(moved>3){ await p.screenshot({path:'shots/jail-inside.png'});
    console.log(`  prompt inside: ${JSON.stringify(await prompt())}`);
    console.log(`  shots/jail-inside.png`); break; }
}
await b.close();
