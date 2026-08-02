// The claim: the exit is no longer an ordinary spot competing on distance, so
// you can always leave a seat regardless of what else is inside the radius.
// Sample seats across every label and try to leave each from a fresh sit.
// The observable state is THE PROMPT, not eye height - pos()[1] stays 1.62 when
// you sit, which is the trap the row records.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:900,height:560}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:20000});
await afterFrames(p,10); await p.waitForTimeout(1200);
const prompt=()=>p.evaluate(()=>{const m=(document.body.innerText||'').match(/\[E\][^\n]*/);return m?m[0].trim():null;});
const pos=()=>p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
const seats=await p.evaluate(()=>(window.__ct.seats?.()||[]).filter(q=>q.at&&q.label));
const byLabel=new Map();
for(const s of seats){ if(!byLabel.has(s.label)) byLabel.set(s.label,s); }
console.log(`\nseats published: ${seats.length}, distinct labels: ${byLabel.size}`);
let ok=0, bad=[], tried=0;
for(const [label,s] of byLabel){
  await p.evaluate(([x,z])=>window.__ct.warp(x,z,0,window.__ct.groundAt(x,z),0),[s.at.x,s.at.z]);
  await afterFrames(p,5); await p.mouse.click(450,280); await p.waitForTimeout(220);
  const p0=await prompt();
  if(!p0||!/sit|watch|slot|bench|pew|stool|chair/i.test(p0)) { continue; }
  await p.keyboard.press('e'); await afterFrames(p,8); await p.waitForTimeout(500);
  const p1=await prompt(); const seatedAt=await pos();
  if(!p1||!/stand|stop watching|get up|leave/i.test(p1)){ continue; }   // did not seat
  tried++;
  await p.keyboard.press('e'); await afterFrames(p,8); await p.waitForTimeout(500);
  const p2=await prompt(); const after=await pos();
  const left = p2!==p1 && !/stand up|stop watching/i.test(p2||'');
  if(left) ok++; else bad.push(`${label}  seated prompt ${JSON.stringify(p1)} -> after E ${JSON.stringify(p2)}`);
}
console.log(`\nseats entered and exited: ${ok} of ${tried} distinct labels`);
for(const q of bad) console.log(`   ** ${q}`);
console.log(`\n  ${tried&&ok===tried ? 'every seat tried lets you out on one press of E' : bad.length? '** some seats did not release' : 'CANNOT ANSWER — no seat was entered'}`);
await b.close();
