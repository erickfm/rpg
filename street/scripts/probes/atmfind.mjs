import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(1500);
const r=await p.evaluate(()=>{const o=[];window.__ct.scene().traverse(m=>{
 const s=`${m.name||''} ${JSON.stringify(m.userData||{})}`; if(!/atm|federal/i.test(s))return;
 o.push({n:m.name||'?',ud:m.userData,x:+m.position.x.toFixed(2),y:+m.position.y.toFixed(2),z:+m.position.z.toFixed(2)});});
 const d=(window.__ct.doors?.()||[]).filter(x=>/atm|federal|bank/i.test(JSON.stringify(x)));
 return {o,d};});
console.log(JSON.stringify(r,null,1).slice(0,1400));
await b.close();
