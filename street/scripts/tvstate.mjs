// "tv off unless i sit down to watch it pls" - C built it as a STATE MACHINE,
// on = f(seated watching), and publishes scene.userData.tv.on. Test every way of
// being in the room, including the respawn case C says a toggle gets wrong.
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:900,height:560}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1200);
const on=()=>p.evaluate(()=>{ const t=window.__ct.scene().userData.tv; return t? t.on : null; });
const pos=()=>p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
const prompt=()=>p.evaluate(()=>{const m=(document.body.innerText||'').match(/\[E\][^\n]*/);return m?m[0].trim():null;});
const at=async(x,z)=>{ await p.evaluate(([x,z])=>window.__ct.warp(x,z,0,window.__ct.pos()[3],0),[x,z]); await afterFrames(p,5); await p.waitForTimeout(250); };
const rows=[];
const rec=async(label,want)=>{ const v=await on(); rows.push({label,v,want,ok:v===want});
  console.log(`   ${label.padEnd(34)} on=${String(v).padEnd(5)} want ${String(want).padEnd(5)} ${v===want?'ok':'** MISMATCH'}`); };
console.log(`\nscene.userData.tv.on across every way of being in the room:`);
await rec('on load', false);
await at(198.30,-16.30);  await rec('standing in 301', false);
await at(197.70,-15.40);  await rec('standing right next to the set', false);
await at(197.40,-15.80);  await rec('beside the bed', false);
// seated
await at(198.30,-16.30);
await p.mouse.click(450,280); await p.waitForTimeout(200);
await p.keyboard.press('e'); await afterFrames(p,10); await p.waitForTimeout(700);
const seated=await pos(); const pr=await prompt();
console.log(`      (seated at (${seated[0]}, ${seated[2]}), prompt ${JSON.stringify(pr)})`);
await rec('SEATED, watching', true);
// respawn out of the seat: lose the floor inside the walk-up
await p.evaluate(()=>window.__ct.warp(198.6,-16.3,0,50,0));
await afterFrames(p,8); await p.waitForTimeout(900);
const back=await pos();
console.log(`      (respawned to (${back[0]}, ${back[2]}) gy ${back[3]})`);
await rec('after a RESPAWN out of the seat', false);
// out on the street
await p.evaluate(()=>window.__ct.warp(-6.2,-40,0,0.14,0)); await afterFrames(p,6); await p.waitForTimeout(300);
await rec('out on the street', false);
const bad=rows.filter(r=>!r.ok).length;
console.log(`\n  ${rows.length} states, ${bad} mismatched`);
console.log(`  ${bad===0 ? 'the set is on ONLY when seated watching — a state, not a toggle' : '** the state machine does not hold'}`);
await b.close();
process.exit(bad?1:0);
