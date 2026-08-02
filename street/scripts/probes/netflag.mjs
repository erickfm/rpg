// H widened netRoute so an outside test can read an edge's road flag. I left the
// row LANDED saying I could not read it; re-check it now that I can.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
console.log(await p.evaluate(()=>{
 const nr=window.__ct.netRoute; if(!nr) return 'netRoute still absent';
 let r=null;
 try { r = nr('s-east','ne-corner'); } catch(e){ return 'netRoute(s-east,ne-corner) threw: '+e.message; }
 let s='netRoute("s-east","ne-corner") -> '+JSON.stringify(r).slice(0,400)+'\n';
 let r2=null; try { r2 = nr('w-win1','w-alley'); } catch(e){ r2={err:e.message}; }
 s+='netRoute("w-win1","w-alley")   -> '+JSON.stringify(r2).slice(0,400)+'\n';
 return s;}));
await b.close();
