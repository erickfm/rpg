// D's residual: 25% of winning prompts are more than 15 deg off aim and the
// worst is 180 deg - directly behind. That is the user's complaint verbatim.
// But D's design says aim-free selection is INTENDED at touching distance
// (d < r + 0.15) and everything further must be aimed at. So the question is
// not "are there off-axis winners" but "are the off-axis winners all close".
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:800,height:600}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1200);
// UNIQUE LABELS ONLY. "sit on the bench" names nine different benches, so a
// station 1.6 m past bench A can sit inside bench B and the label still matches
// - my first run counted that as A leaking. Identity again: the label is not the
// object.
const all=await p.evaluate(()=>window.__ct.spots().filter(s=>s.ok));
const count={}; for(const s of all) count[s.label]=(count[s.label]||0)+1;
const spots=all.filter(s=>count[s.label]===1);
console.log(`spots with a unique label: ${spots.length} of ${all.length}`);
const prompt=()=>p.evaluate(()=>{const m=(document.body.innerText||'').match(/\[E\][^\n]*/);return m?m[0].trim():null;});
const rows=[];
for(const s of spots.slice(0,16)){
  for(const dr of [0.05, 0.30, 0.80, 1.60]){          // distance beyond the radius
    for(let k=0;k<8;k++){
      const th=k*Math.PI/4, d=s.r+dr;
      const sx=s.x+Math.cos(th)*d, sz=s.z+Math.sin(th)*d;
      // face AWAY from the spot: 180 deg off aim
      const away=Math.atan2(sx-s.x,-(sz-s.z));
      await p.evaluate(([x,z,y])=>window.__ct.warp(x,z,y,window.__ct.pos()[3],0),[sx,sz,away]);
      await afterFrames(p,3);
      const got=await p.evaluate(()=>window.__ct.pos());
      if(Math.hypot(got[0]-sx,got[2]-sz)>0.4) continue;      // pushed out
      const pr=await prompt();
      // and the nearest OTHER spot must be further away than this one, or the
      // prompt could legitimately belong to it
      const near=await p.evaluate(([x,z])=>{ const q=window.__ct.spots().filter(t=>t.ok)
        .map(t=>({l:t.label,d:Math.hypot(t.x-x,t.z-z)})).sort((a,b)=>a.d-b.d)[0]; return q; },[sx,sz]);
      const mine=!!pr&&pr.includes(s.label.split('—')[0].trim().slice(0,12))&&near.l===s.label;
      // BUCKET BY WHERE I LANDED, not where I asked. Collision can push the
      // player up to 0.4 m, so a station asked at r+0.30 can land inside
      // r+0.15 and read as a leak when it is the intended touching zone.
      const actual=Math.hypot(got[0]-s.x,got[2]-s.z)-s.r;
      rows.push({dr, mine, actual:+actual.toFixed(2)});
    }
  }
}
console.log(`\nstations facing 180 deg AWAY from a spot, by how far past its radius:`);
console.log(`  beyond r by   stations   offered anyway`);
for(const dr of [0.05,0.30,0.80,1.60]){
  const g=rows.filter(r=>r.dr===dr);
  const on=g.filter(r=>r.mine).length;
  console.log(`  ${String(dr).padStart(8)} m ${String(g.length).padStart(9)}   ${String(on).padStart(6)}  (${g.length?Math.round(100*on/g.length):0}%)`);
}
const near=rows.filter(r=>r.actual<=0.15), far=rows.filter(r=>r.actual>0.15);
const nOn=near.filter(r=>r.mine).length, fOn=far.filter(r=>r.mine).length;
console.log(`\n  within touching distance (r + 0.15): ${nOn} of ${near.length} offered while facing away — D says this is INTENDED`);
console.log(`  beyond it:                           ${fOn} of ${far.length} offered while facing away — these would be leaks`);
const leaks=far.filter(r=>r.mine).map(r=>r.actual).sort((a,b)=>b-a);
if(leaks.length) console.log(`  furthest aim-free offer, measured from where I stood: r + ${leaks[0]} m`);
console.log(`\n  ${fOn===0 ? 'the aim-free zone stops where D says it does — nothing beyond r + 0.15 is offered unaimed'
                            : '** aim-free selection reaches past r + 0.15'}`);
await b.close();
