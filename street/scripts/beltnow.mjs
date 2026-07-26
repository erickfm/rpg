import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2000);
console.log(await p.evaluate(()=>window.__ct.roomDims().map(r=>`${r.id}@${r.cx}`).join('  ')));
await b.close();
