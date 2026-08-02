import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{const c=window.__ct.colliders();
 return {n:c.length, keys:Object.keys(c[0]||{}), sample:JSON.stringify(c.slice(0,3)),
   radius:window.__ct.RADIUS ?? null};});
console.log(`colliders ${r.n}  keys ${r.keys}  RADIUS ${r.radius}`);
console.log(r.sample.slice(0,600));
// where are the walkable bands?
const bands=await p.evaluate(()=>{const out=[];
 for(const z of [10,0,-10,-25,-40,-55,-70,-85]){
  const row=[]; for(let x=-12;x<=12;x+=0.25) row.push(+window.__ct.groundAt(x,z).toFixed(2));
  out.push({z,row});} return out;});
for(const {z,row} of bands){
  let s=''; for(let i=0;i<row.length;i++) s+= row[i]>0.1?'#':(row[i]===0?'.':'~');
  console.log(`z ${String(z).padStart(4)}  x-12..12  ${s}`);
}
await b.close();
