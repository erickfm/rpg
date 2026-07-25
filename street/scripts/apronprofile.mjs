// Is the apron RAMPED and does it ABUT the walk? Both are profile questions.
// Sample groundAt across the driveway line, and across a plain kerb for contrast.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto('http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
const scan=async(z)=>p.evaluate((z)=>{const o=[];for(let x=1;x<=13;x+=0.25)o.push([+x.toFixed(2),+window.__ct.groundAt(x,z).toFixed(3)]);return o;},z);
for(const [n,z] of [['DRIVEWAY z=2.6',2.6],['plain kerb z=-20',-20]]){
  const s=await scan(z); const ys=s.map(r=>r[1]);
  console.log(`\n${n}  min ${Math.min(...ys)} max ${Math.max(...ys)}`);
  console.log('  '+s.map(([x,y])=>`${x}:${y}`).join(' '));
  let big=0,st=null; for(let i=1;i<s.length;i++){const d=s[i][1]-s[i-1][1]; if(Math.abs(d)>0.02){big++; if(!st)st=`${s[i-1][0]}->${s[i][0]} ${d>0?'+':''}${d.toFixed(3)}`;}}
  console.log(`  steps>2cm: ${big}  first: ${st||'none'}`);
}
// what mesh IS the apron, and is it textured?
const m=await p.evaluate(()=>{const out=[];window.__ct.scene().traverse(o=>{if(!o.isMesh)return;
  o.geometry.computeBoundingBox(); const bb=o.geometry.boundingBox.clone(); bb.applyMatrix4(o.matrixWorld);
  if(bb.min.x>3&&bb.max.x<14&&bb.min.z<4&&bb.max.z>1&&bb.max.y<1.0&&(bb.max.x-bb.min.x)>0.8)
   out.push({n:o.name||o.userData?.kind||'?',x:[+bb.min.x.toFixed(2),+bb.max.x.toFixed(2)],z:[+bb.min.z.toFixed(2),+bb.max.z.toFixed(2)],y:[+bb.min.y.toFixed(3),+bb.max.y.toFixed(3)],tex:!!o.material?.map,side:o.material?.side});});return out;});
console.log(`\nmeshes at the lot mouth (${m.length}):`);
for(const o of m) console.log(`  ${o.n.padEnd(16)} x${o.x} z${o.z} y${o.y} tex=${o.tex} side=${o.side}`);
await b.close();
