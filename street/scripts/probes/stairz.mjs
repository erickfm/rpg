// My scanlines ran along x. A stair could run along z instead - scan that way
// across the whole raised strip before concluding it is unreachable.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2000);
console.log(await p.evaluate(()=>{
 const d=window.__ct.roomDims().find(q=>q.id==='library');
 let s='', anyStair=false;
 for(let x=d.cx+5; x<=d.cx+d.w/2-0.2; x+=0.5){
  const line=[];
  for(let z=d.cz-d.d/2+0.3; z<=d.cz+d.d/2-0.3; z+=0.25) line.push(+window.__ct.groundAt(x,z).toFixed(2));
  const uniq=[...new Set(line)].sort((a,b)=>a-b);
  if(uniq.length>2){ anyStair=true;
   s+=`x ${x.toFixed(1)}: ${uniq.length} distinct levels — ${uniq.join(', ')}\n`; }
 }
 if(!anyStair) s+='no column in the raised strip has more than two floor levels — no graded rise anywhere\n';
 // and the whole room: how many distinct heights exist at all?
 const all=new Set();
 for(let x=d.cx-d.w/2+0.3;x<=d.cx+d.w/2-0.3;x+=0.4) for(let z=d.cz-d.d/2+0.3;z<=d.cz+d.d/2-0.3;z+=0.4)
  all.add(+window.__ct.groundAt(x,z).toFixed(2));
 s+=`\ndistinct walkable floor heights in the whole library: ${[...all].sort((a,b)=>a-b).join(', ')}\n`;
 return s;}));
await b.close();
