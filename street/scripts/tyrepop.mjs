// What IS a tyre in this scene? looks.mjs finds them by the flat colour #101114;
// F says tyres carry a MAP and props carry flat colour. Both cannot be right,
// and my own filter found none. Ask the scene.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
console.log(await p.evaluate(()=>{
  const s=window.__ct.scene(); s.updateMatrixWorld(true);
  const byHex={}, types={}, sample=[];
  s.traverse(o=>{ if(!o.isMesh||!o.geometry) return;
    const m=Array.isArray(o.material)?o.material[0]:o.material; if(!m) return;
    if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if(bb.max.y>1.2) return;
    const hex=m.color?m.color.getHexString():'none';
    if(hex!=='101114') return;
    byHex[hex]=(byHex[hex]||0)+1;
    const t=o.geometry.type||'?';
    types[t]=(types[t]||0)+1;
    if(sample.length<6){ const g=o.geometry.parameters||{};
      sample.push(`${t} r=${g.radiusTop??g.radiusBottom??'-'} map=${!!m.map} at (${((bb.min.x+bb.max.x)/2).toFixed(1)}, ${((bb.min.z+bb.max.z)/2).toFixed(1)}) top ${bb.max.y.toFixed(3)}`); }
  });
  return `meshes below 1.2 m with colour #101114: ${byHex['101114']||0}\n`
       + `  geometry types: ${JSON.stringify(types)}\n  samples:\n    `+sample.join('\n    ');
}));
console.log(await p.evaluate(()=>{
  const s=window.__ct.scene(); let mapped=0, flat=0;
  s.traverse(o=>{ if(!o.isMesh||!o.geometry) return;
    if((o.geometry.type||'')!=='CylinderGeometry') return;
    const g=o.geometry.parameters||{}; const r=g.radiusTop??g.radiusBottom;
    if(!(r>=0.18&&r<=0.42)) return;
    const m=Array.isArray(o.material)?o.material[0]:o.material; if(!m) return;
    if(m.map) mapped++; else flat++; });
  return `\ncylinders r 0.18-0.42 anywhere:  with a map ${mapped}   flat colour ${flat}`;
}));
await b.close();
