// Two rows: (1) does the hotel INTERIOR use the exterior's own constants
// (#8e1f2a, #5a1520, #8a6a22) rather than lookalikes; (2) is the side street's
// east-end edge now flagged as a crossing.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{
 const hexOf=(m)=>m?.color?m.color.getHexString():null;
 const bucket=(pred)=>{const c={}; window.__ct.scene().traverse(o=>{ if(!o.isMesh)return;
   const e=o.matrixWorld.elements; if(!pred(e[12],e[14])) return;
   for(const m of (Array.isArray(o.material)?o.material:[o.material])){ const h=hexOf(m); if(h) c[h]=(c[h]||0)+1; }});
  return c;};
 const dims=window.__ct.roomDims().find(q=>q.id==='hotel');
 const inside=bucket((x,z)=>Math.abs(x-dims.cx)<dims.w&&Math.abs(z-dims.cz)<dims.d);
 const outside=bucket((x,z)=>x>33&&x<47&&z>-99&&z<-90);
 // the graph, if it is reachable
 let net=null;
 try{ const n=window.__ct.netRoute&&window.__ct.netRoute.net?window.__ct.netRoute.net:null;
      if(n&&n.edges) net={nodes:n.nodes.length, edges:n.edges.length,
        road:n.edges.filter(e=>e.road).length,
        eastEnd:n.edges.filter(e=>{const a=n.nodes[e.a],c=n.nodes[e.b];
          return a&&c&&Math.min(a.x,c.x)>50&&Math.abs(a.z-c.z)>6;}).map(e=>({a:n.nodes[e.a].id||e.a,b:n.nodes[e.b].id||e.b,road:!!e.road}))};
 }catch(err){ net={err:String(err.message)}; }
 return {inside, outside, net, keys:Object.keys(window.__ct)};});
const want=['8e1f2a','5a1520','8a6a22'];
console.log('hotel INTERIOR — the three exterior constants:');
for(const w of want) console.log(`   #${w}  ${r.inside[w]?`present on ${r.inside[w]} material(s)`:'** ABSENT'}`);
console.log(`   distinct colours inside: ${Object.keys(r.inside).length}`);
console.log('\nhotel EXTERIOR block — same three:');
for(const w of want) console.log(`   #${w}  ${r.outside[w]?`present on ${r.outside[w]} material(s)`:'absent'}`);
const shared=Object.keys(r.inside).filter(h=>r.outside[h]);
console.log(`   colours shared between inside and outside: ${shared.length}  ${shared.slice(0,10).map(h=>'#'+h).join(' ')}`);
console.log(`\ngraph: ${JSON.stringify(r.net).slice(0,400)}`);
await b.close();
