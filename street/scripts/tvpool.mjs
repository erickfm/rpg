// C's predicate: scene.userData.tv publishes {seg, i, left, pool}. Watch and
// count DISTINCT segment names - far better than my pixel sampling, which could
// only see "the colour changed" and once read the wall instead of the screen.
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1000,height:640}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1200);
await p.evaluate(()=>window.__ct.clock(23,10)); await afterFrames(p,6);
await p.evaluate(()=>window.__ct.warp(198.30,-16.30,0,window.__ct.pos()[3],0)); await afterFrames(p,5);
const pr=await p.evaluate(()=>{const m=(document.body.innerText||'').match(/\[E\][^\n]*/);return m?m[0].trim():null;});
await p.keyboard.press('e'); await afterFrames(p,10); await p.waitForTimeout(600);
console.log(`\nprompt at the station: ${JSON.stringify(pr)}`);
const tv0=await p.evaluate(()=>window.__ct.scene().userData.tv);
if(!tv0){ console.error('CANNOT ANSWER — scene.userData.tv is not published.'); process.exit(3); }
console.log(`scene.userData.tv publishes: ${JSON.stringify(tv0).slice(0,200)}`);
console.log(`pool size as declared: ${Array.isArray(tv0.pool)?tv0.pool.length:'(not an array)'}`);
const seen=new Map(); const order=[];
for(let i=0;i<60;i++){
  const t=await p.evaluate(()=>{ const v=window.__ct.scene().userData.tv; return v&&{seg:v.seg,i:v.i,left:v.left}; });
  if(t&&t.seg){ if(!seen.has(t.seg)) seen.set(t.seg,0);
    seen.set(t.seg,seen.get(t.seg)+1);
    if(!order.length||order[order.length-1]!==t.seg) order.push(t.seg); }
  await p.waitForTimeout(2000);
}
console.log(`\nwatched 2 minutes. distinct segments seen: ${seen.size}`);
for(const [k,v] of [...seen.entries()].sort((a,b)=>b[1]-a[1])) console.log(`   ${String(v).padStart(3)} samples   ${k}`);
console.log(`\nthe order they played (${order.length} changes):`);
console.log('   '+order.join(' -> '));
let immediate=0; for(let i=1;i<order.length;i++) if(order[i]===order[i-1]) immediate++;
console.log(`\n  segments that followed themselves: ${immediate}`);
console.log(`  ${seen.size>=4 && immediate===0 ? 'a pool of several, shuffled with no immediate repeat' : seen.size<4 ? '** too few distinct segments to be a pool' : '** a segment repeated immediately'}`);
await p.screenshot({path:'shots/tv-bezel.png'});
console.log(`  shots/tv-bezel.png`);
await b.close();
