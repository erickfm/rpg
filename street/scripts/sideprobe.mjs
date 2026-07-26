import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto('http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2000);
const r=await p.evaluate(()=>{const o=[];
 for(const x of [12,20,30,40,50]){const row=[];
  for(let z=-95;z>=-113;z-=0.25) row.push(+window.__ct.groundAt(x,z).toFixed(2));
  o.push({x,row});} return o;});
for(const {x,row} of r){
 let s=''; for(const v of row) s+= v>0.1?'#':(v===0?'.':'~');
 console.log(`x ${String(x).padStart(3)}  z -95 -> -113  ${s}`);}
await b.close();
