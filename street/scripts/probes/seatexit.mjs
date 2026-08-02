// "pressing e doesnt get me out of it — stuck in the TV seat"
// C could not reproduce it but found WHY it is luck: standing up is registered
// as an ordinary spot and must WIN the E resolver, surviving only because a
// seated player is 0 m from it. So the test is not "does E work today" but
// "what else is in the running while you are seated".
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:900,height:560}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1200);
const prompt=()=>p.evaluate(()=>{const m=(document.body.innerText||'').match(/\[E\][^\n]*/);return m?m[0].trim():null;});
const pos=()=>p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
await p.evaluate(()=>window.__ct.warp(198.30,-16.30,0,window.__ct.pos()[3],0)); await afterFrames(p,5);
await p.mouse.click(450,280); await p.waitForTimeout(200);
await p.keyboard.press('e'); await afterFrames(p,10); await p.waitForTimeout(700);
const seated=await pos();
console.log(`\nseated at (${seated[0]}, ${seated[2]})  prompt ${JSON.stringify(await prompt())}`);
// what else is in the running?
const rivals=await p.evaluate(([x,z])=>window.__ct.spots().filter(s=>s.ok)
  .map(s=>({l:s.label,r:s.r,d:+Math.hypot(s.x-x,s.z-z).toFixed(2)}))
  .filter(s=>s.d < s.r+2.0).sort((a,b)=>a.d-b.d), [seated[0],seated[2]]);
console.log(`\nspots within reach of the seat (d < r + 2 m):`);
for(const s of rivals) console.log(`   ${s.d} m  (r ${s.r})  "${s.l}"`);
const standRow=rivals.find(s=>/stand up/i.test(s.l));
const others=rivals.filter(s=>!/stand up/i.test(s.l));
console.log(`\n   stand-up spot at ${standRow? standRow.d+' m' : '(not published)'}`);
console.log(`   nearest rival: ${others.length? `${others[0].d} m — "${others[0].l}"` : 'none'}`);
console.log(`   margin: ${standRow&&others.length? (others[0].d-standRow.d).toFixed(2)+' m' : 'n/a'}`);
// and does E actually work from every look direction?
let ok=0, tried=0, fails=[];
for(const yaw of [0,1.05,2.09,3.14,4.19,5.24]){
  for(const pitch of [-1.4,-0.7,0,0.7,1.4]){
    await p.evaluate(([y,pi])=>{ const q=window.__ct.pos(); window.__ct.warp(q[0],q[2],y,q[3],pi); },[yaw,pitch]);
    await afterFrames(p,3);
    const pr=await prompt(); tried++;
    if(/stand up/i.test(pr||'')) ok++; else fails.push(`yaw ${yaw.toFixed(2)} pitch ${pitch}: ${JSON.stringify(pr)}`);
  }
}
console.log(`\n   "[E] stand up" offered in ${ok} of ${tried} look directions`);
for(const f of fails.slice(0,5)) console.log(`      ** ${f}`);
await p.keyboard.press('e'); await afterFrames(p,10); await p.waitForTimeout(600);
const up=await pos();
console.log(`\n   pressed E: (${up[0]}, ${up[2]})  ${Math.hypot(up[0]-seated[0],up[2]-seated[2])>0.3?'STOOD UP':'** still seated'}`);
await b.close();
