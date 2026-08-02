// Measure what a given object is actually near. Usage: edit the probe() calls
// at the bottom to the world centre of the mesh you want, then run it. This is
// the check a builder should run after fixing a float: nearest neighbour gap
// must come back 0, and to the RIGHT thing.
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, process.env.SHOT_URL ?? 'http://localhost:4184/');   // GOTCHAS 26: prove it, do not just name it
await p.waitForTimeout(1000);
const r = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const all = [];
  s.traverse(o => { if (!o.isMesh || !o.geometry) return;
    for (let q=o;q;q=q.parent) if (q.visible===false) return;
    const g=o.geometry; if(!g.boundingBox) g.computeBoundingBox(); if(!g.boundingBox) return;
    const bb=g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    all.push({min:[bb.min.x,bb.min.y,bb.min.z],max:[bb.max.x,bb.max.y,bb.max.z],
      geo:g.type,size:[bb.max.x-bb.min.x,bb.max.y-bb.min.y,bb.max.z-bb.min.z].map(v=>+v.toFixed(2))});});
  const gap=(a,b)=>{const d=(l1,h1,l2,h2)=>l1>h2?l1-h2:l2>h1?l2-h1:0;
    return +Math.hypot(d(a.min[0],a.max[0],b.min[0],b.max[0]),d(a.min[1],a.max[1],b.min[1],b.max[1]),d(a.min[2],a.max[2],b.min[2],b.max[2])).toFixed(3);};
  const probe=(cx,cy,cz,label)=>{
    const me=all.find(t=>Math.abs((t.min[0]+t.max[0])/2-cx)<0.06&&Math.abs((t.min[1]+t.max[1])/2-cy)<0.06&&Math.abs((t.min[2]+t.max[2])/2-cz)<0.06);
    if(!me) return {label,err:'not found'};
    const n=all.filter(t=>t!==me).map(t=>({g:gap(me,t),geo:t.geo,size:t.size,c:[(t.min[0]+t.max[0])/2,(t.min[1]+t.max[1])/2,(t.min[2]+t.max[2])/2].map(v=>+v.toFixed(2))}))
      .sort((a,b2)=>a.g-b2.g).slice(0,5);
    return {label,me:{geo:me.geo,size:me.size,minY:+me.min[1].toFixed(2)},nearest:n};
  };
  return [probe(44.35,7.4,-96.72,'HOTEL blade mast'),
          probe(51.23,19.3,-98.2,'SEVENS leg (street side)'),
          probe(201.8,4.61,-10.5,'apartment stair flight'),
          probe(201.2,5.15,-16.5,'apartment ceiling dome')];
});
for (const x of r) { console.log('###', x.label, JSON.stringify(x.me)); (x.nearest??[]).forEach(n=>console.log('   gap',n.g,'m ->',n.geo,n.size.join('x'),'at',n.c.join(','))); console.log(''); }
await b.close();
