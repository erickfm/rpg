// A raised floor is not a stair. Profile the transition: if the ground steps up
// in climbable increments it is a stair; if it jumps 2.9 m in one sample it is a
// mezzanine you cannot reach on foot.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2000);
console.log(await p.evaluate(()=>{
 const d=window.__ct.roomDims().find(q=>q.id==='library');
 let s='';
 for(const z of [-10.5,-4.5,0.5,5.5]){
  const line=[];
  for(let x=d.cx-2; x<=d.cx+d.w/2-0.2; x+=0.25) line.push(+window.__ct.groundAt(x,z).toFixed(2));
  const steps=[]; for(let i=1;i<line.length;i++){const dz=line[i]-line[i-1]; if(Math.abs(dz)>0.02) steps.push(+dz.toFixed(2));}
  const big=steps.filter(v=>v>0.45);
  s+=`z ${String(z).padStart(6)}: ${line.join(' ')}\n`;
  s+=`         rises: ${steps.filter(v=>v>0).join(', ')||'none'}   steps over 0.45 m (unclimbable): ${big.length}\n`;
 }
 return s;}));
await b.close();
