// Three more of the evidence-less CONFIRMED rows, cheapest first.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1100,height:700}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1200);
await p.evaluate(()=>window.__ct.clock(13,0)); await afterFrames(p,5);

// ── 1. "library courtyard benches sittable" — a seat spot is the predicate
console.log(`\n1. LIBRARY COURTYARD BENCHES — are they sittable?`);
const lib=await p.evaluate(()=>window.__ct.doors().find(d=>/LIBRARY/i.test(d.building)));
const seats=await p.evaluate(([dx,dz])=>window.__ct.spots().filter(s=>/sit/i.test(s.label))
  .map(s=>({l:s.label,x:+s.x.toFixed(2),z:+s.z.toFixed(2),ok:s.ok,d:+Math.hypot(s.x-dx,s.z-dz).toFixed(1)}))
  .filter(s=>s.d<22).sort((a,b)=>a.d-b.d), [lib.point.x,lib.point.z]);
console.log(`   library door at (${lib.point.x.toFixed(1)}, ${lib.point.z.toFixed(1)})`);
console.log(`   sit-spots within 22 m: ${seats.length}`);
for(const s of seats.slice(0,6)) console.log(`      ${s.d} m  (${s.x}, ${s.z})  ok=${s.ok}  "${s.l}"`);
// actually sit on the nearest
if(seats.length){
  const s=seats[0];
  await p.evaluate(([x,z])=>window.__ct.warp(x,z,0,window.__ct.groundAt(x,z),0),[s.x,s.z]);
  await afterFrames(p,5);
  const pr=await p.evaluate(()=>{const m=(document.body.innerText||'').match(/\[E\][^\n]*/);return m?m[0].trim():null;});
  const before=await p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
  await p.keyboard.press('e'); await afterFrames(p,8); await p.waitForTimeout(500);
  const after=await p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
  const pr2=await p.evaluate(()=>{const m=(document.body.innerText||'').match(/\[E\][^\n]*/);return m?m[0].trim():null;});
  console.log(`   stood ${JSON.stringify(pr)} -> pressed E -> ${JSON.stringify(pr2)}`);
  console.log(`   moved ${Math.hypot(after[0]-before[0],after[2]-before[2]).toFixed(2)} m — ${/stand up/i.test(pr2||'')?'SEATED':'** did not seat'}`);
}

// ── 2. "casino + hotel blades read correctly" — and the casino is now SEVENS
console.log(`\n2. THE BLADES — legible, and do they carry the CURRENT name?`);
for(const [n,x,z,tx,tz,pi] of [
 ['west', 30,-100, 44.4,-96.8, 0.45],
 ['east', 56,-100, 44.4,-96.8, 0.45],
]){
 await p.evaluate(([x,z,y,pi])=>window.__ct.warp(x,z,y,window.__ct.groundAt(x,z),pi),
   [x,z,Math.atan2(tx-x,-(tz-z)),pi]);
 await afterFrames(p,5);
 await p.screenshot({path:`shots/blade-${n}.png`});
 console.log(`   shots/blade-${n}.png`);
}

// ── 3. "world stops reloading under the player" — no reload over a minute
console.log(`\n3. WORLD RELOADS — the page must not reload under you`);
await p.evaluate(()=>{ window.__reloadWatch = (window.__reloadWatch||0)+1; });
const mark=await p.evaluate(()=>window.__reloadWatch);
let navs=0; p.on('framenavigated',()=>navs++);
await p.waitForTimeout(45000);
const still=await p.evaluate(()=>window.__reloadWatch);
console.log(`   marker set to ${mark}; after 45 s it reads ${still}   frame navigations: ${navs}`);
console.log(`   ${still===mark&&navs===0 ? 'NO RELOAD — the marker survived and nothing navigated' : '** the world reloaded under the player'}`);
await b.close();
