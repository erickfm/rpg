// groundAt around a point, both axes. Written because footpaint read ground 0
// under a citizen whose foot is at 5.4 and whose floor is at 5.4.
import {chromium} from 'playwright';
const [cx,cz]=(process.env.AT??'201.9,-16.5').split(',').map(Number);
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL??'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction('!!window.__ct',{timeout:60000}); await p.waitForTimeout(2500);
console.log(await p.evaluate(([cx,cz])=>{ const g=window.__ct.groundAt; const L=[];
 const P=window.__ct.pos(); L.push(`  player at (${P[0].toFixed(2)}, ${P[1].toFixed(2)}, ${P[2].toFixed(2)})`);
 L.push(`  groundAt(${cx}, ${cz}) = ${g(cx,cz)}`);
 L.push('');
 for(let d=-1.5;d<=1.5;d+=0.5) L.push(`  x ${(cx+d).toFixed(2)} -> ${g(cx+d,cz).toFixed(2)}`);
 L.push('');
 for(let d=-1.5;d<=1.5;d+=0.5) L.push(`  z ${(cz+d).toFixed(2)} -> ${g(cx,cz+d).toFixed(2)}`);
 return L.join('\n'); },[cx,cz]));
await b.close();
