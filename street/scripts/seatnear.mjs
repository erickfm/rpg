import {chromium} from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL??'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction('!!window.__ct',{timeout:60000}); await p.waitForTimeout(2500);
const T=[[602.44,13.42],[604.36,4.98],[596.28,14.58],[598.2,10.22]];
console.log(await p.evaluate(T=>{ const s=window.__ct.seats?.()||[]; const L=[`seats in world: ${s.length}`];
 for(const [x,z] of T){ let best=null,bd=1e9;
  for(const q of s){ const qx=q.x??q.pose?.x, qz=q.z??q.pose?.z; if(qx==null) continue;
   const d=Math.hypot(qx-x,qz-z); if(d<bd){bd=d;best=q;} }
  L.push(` figure (${x}, ${z}) -> nearest seat ${bd<1e9?bd.toFixed(2)+' m  '+JSON.stringify(best).slice(0,180):'none'}`); }
 return L.join('\n'); },T));
await b.close();
