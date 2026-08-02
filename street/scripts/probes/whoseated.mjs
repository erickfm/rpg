import { aim } from '../lib/aim.mjs';
import {chromium} from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction('!!window.__ct',{timeout:60000}); await p.waitForTimeout(2500);
console.log(await p.evaluate(()=>{ const c=window.__ct, L=[];
 for(const k of ['seated','people']){
  try{ const v=c[k]?.(); L.push(`${k}: ${JSON.stringify(v).slice(0,1400)}`);}catch(e){L.push(`${k}: ${e.message}`);}}
 return L.join('\n\n'); }));
await b.close();
