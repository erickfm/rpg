import { aim } from '../lib/aim.mjs';
import {chromium} from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction('!!window.__ct',{timeout:60000}); await p.waitForTimeout(2500);
console.log(await p.evaluate(()=>Object.keys(window.__ct).sort().join('  ')));
console.log('\nline objects in the scene at rest, by parent:');
console.log(await p.evaluate(()=>{ const m={};
 window.__ct.scene().traverse(o=>{ if(o.isLine||o.isLineSegments||o.isLineLoop){
  const k=o.parent?.name||o.parent?.type||'?'; m[k]=(m[k]||0)+1; }});
 return JSON.stringify(m); }));
await b.close();
