// M's loan: "Three interactions, not a sign: the FORM on the desk sets the
// amount, the OFFICER submits it, and WINDOW 2 counts the cash out."
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1000,height:640}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1200);
const prompt=()=>p.evaluate(()=>{const m=(document.body.innerText||'').match(/\[E\][^\n]*/);return m?m[0].trim():null;});
const cash=()=>p.evaluate(()=>{ const s=window.__ct.scene().userData; 
  const w=s.purse||s.wallet||s.pockets; return w&&(w.cash??w.money??null); });
const go=async(x,z)=>{ await p.evaluate(([x,z])=>window.__ct.warp(x,z,0,window.__ct.groundAt(x,z),0),[x,z]);
  await afterFrames(p,5); await p.waitForTimeout(300); };
await p.evaluate(()=>window.__ct.warp(440,4,0,0,0)); await afterFrames(p,5);
await p.mouse.click(500,300); await p.waitForTimeout(250);
console.log(`\ncash before: ${cash()===null?'(not published)':await cash()}`);
for(const [label,x,z] of [
  ['the FORM  ',443.75, 1.93],
  ['the OFFICER',444.40, 0.95],
  ['ask about a loan',441.80,-4.30],
]){
  await go(x,z);
  const pr=await prompt();
  console.log(`  at ${label} (${x}, ${z}): ${JSON.stringify(pr)}`);
  if(pr){ await p.keyboard.press('e'); await afterFrames(p,10); await p.waitForTimeout(800);
    const after=await prompt();
    const panel=await p.evaluate(()=>{ const t=document.body.innerText||'';
      return /loan|amount|term|rate|monthly/i.test(t) ? t.split('\n').filter(x=>x.trim()).slice(0,6).join(' | ') : null; });
    console.log(`     after E: prompt ${JSON.stringify(after)}`);
    if(panel) console.log(`     panel text: ${panel.slice(0,180)}`);
    await p.screenshot({path:`shots/loan-${label.trim().replace(/\W+/g,'-')}.png`});
    await p.keyboard.press('Escape'); await afterFrames(p,6); await p.waitForTimeout(400);
  }
}
console.log(`\ncash after: ${cash()===null?'(not published)':await cash()}`);
await b.close();
