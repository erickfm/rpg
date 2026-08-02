// FLANK COLUMN IS UNRELIABLE — DO NOT USE THE PROUD/INBOARD VERDICT.
// Measured across three cars, this script's flank half-width reads 0.981, 0.826
// and 1.73 where ct/cars.ts puts the flank at 0.90. The proud/inboard call flips
// entirely on that estimate, which is why the same fleet reported "5 proud, 8
// inboard" and looked like a regression.
//
// The TYRE column is sound and independently confirms H's arithmetic: outer x
// measures 0.923-0.966 across eight tyres against a predicted 0.94, and every
// tyre top reads 0.663 against an arch line of 0.72.
//
// So: trust the tyre numbers, ignore the flank comparison until the flank is
// found by declaration rather than by shape.
// Measure the arch instead of squinting at it. H's diagnosis was numeric --
// arch top y=0.61 against a tyre top y=0.68, so 7 cm of tyre stood above the
// arch and, being 0.04 m proud of the flank, hid the arch behind it. Height is
// 0.38 now. That is checkable exactly: compare the tyre's top to the arch's
// top, and the tyre's outer face to the flank.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(aim('http://localhost:4184/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, aim('http://localhost:4184/'));   // GOTCHAS 26: prove it, do not just name it
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);
const out = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const all = [];
  s.traverse(o => { if(!o.isMesh||!o.geometry) return;
    for(let q=o;q;q=q.parent) if(q.visible===false) return;
    const g=o.geometry; if(!g.boundingBox)g.computeBoundingBox(); if(!g.boundingBox)return;
    const bb=g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if(bb.max.x>400) return;
    const m=Array.isArray(o.material)?o.material[0]:o.material;
    all.push({ x0:bb.min.x,x1:bb.max.x,y0:bb.min.y,y1:bb.max.y,z0:bb.min.z,z1:bb.max.z,
      hex: m&&m.color? '#'+m.color.getHexString():null, type:o.geometry.type }); });
  // SELF-LOCATING: the parked fleet is DRAWN, not placed, so a coordinate
  // harvested from one session is a coordinate about a car that may not be
  // there. Find them by shape at run time -- low clusters roughly 1.4-2.8 m
  // one way and 3.2-6.2 m the other, near the carriageway.
  const boxes = [];
  s.traverse(o => { if(!o.isMesh||!o.geometry) return;
    for(let q=o;q;q=q.parent) if(q.visible===false) return;
    const g=o.geometry; if(!g.boundingBox)g.computeBoundingBox(); if(!g.boundingBox)return;
    const bb=g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if (bb.max.x > 400) return;
    boxes.push({x0:bb.min.x,x1:bb.max.x,y0:bb.min.y,y1:bb.max.y,z0:bb.min.z,z1:bb.max.z}); });
  const it = boxes.filter(q=>q.y0<0.9&&q.y1<2.3&&q.y1>0.6), sn=new Array(it.length).fill(false), cl=[];
  const touch=(a,c,g)=>a.x0-g<c.x1&&a.x1+g>c.x0&&a.z0-g<c.z1&&a.z1+g>c.z0&&a.y0-g<c.y1&&a.y1+g>c.y0;
  for(let i=0;i<it.length;i++){ if(sn[i])continue; const st=[i],mem=[]; sn[i]=true;
    while(st.length){const k=st.pop();mem.push(it[k]);
      for(let j=0;j<it.length;j++) if(!sn[j]&&touch(it[k],it[j],0.35)){sn[j]=true;st.push(j);}}
    const x0=Math.min(...mem.map(q=>q.x0)), x1=Math.max(...mem.map(q=>q.x1));
    const z0=Math.min(...mem.map(q=>q.z0)), z1=Math.max(...mem.map(q=>q.z1));
    const w=x1-x0, d=z1-z0, a=Math.min(w,d), l=Math.max(w,d);
    if (a>1.4&&a<2.8&&l>3.2&&l<6.2&&Math.abs((x0+x1)/2)<12) cl.push([+((x0+x1)/2).toFixed(2), +((z0+z1)/2).toFixed(2)]);
  }
  const CARS = cl;
  return CARS.map(([cx,cz]) => {
    const near = all.filter(q => Math.abs((q.x0+q.x1)/2-cx)<1.9 && Math.abs((q.z0+q.z1)/2-cz)<3.2 && q.y1 < 2.4);
    // a tyre: dark, low, small in plan
    const dark = h => { if(!h) return false; const r=parseInt(h.slice(1,3),16),g2=parseInt(h.slice(3,5),16),b2=parseInt(h.slice(5,7),16); return (r+g2+b2)/3 < 60; };
    const tyres = near.filter(q => dark(q.hex) && q.y0 < 0.15 && q.y1 < 0.95 && (q.x1-q.x0) < 1.0 && (q.z1-q.z0) < 1.2);
    // the flank: the widest body panel either side
    const flankX = Math.max(...near.map(q=>Math.abs((q.x0+q.x1)/2-cx)));
    return { car:[cx,cz], nNear: near.length,
      tyres: tyres.map(t=>({ topY:+t.y1.toFixed(3), botY:+t.y0.toFixed(3),
        outX:+(Math.max(Math.abs(t.x0-cx),Math.abs(t.x1-cx))).toFixed(3),
        z:+(((t.z0+t.z1)/2)).toFixed(2), hex:t.hex })),
      flankHalfWidth:+flankX.toFixed(3),
      darkAboveTyre: near.filter(q=>dark(q.hex)&&q.y0>0.2&&q.y1<1.2).map(q=>({y0:+q.y0.toFixed(3),y1:+q.y1.toFixed(3),hex:q.hex})) };
  });
});
for (const c of out) {
  console.log(`\ncar at (${c.car[0]}, ${c.car[1]}) — ${c.nNear} meshes, flank half-width ${c.flankHalfWidth} m`);
  for (const t of c.tyres)
    console.log(`   tyre z${String(t.z).padStart(7)}  top y ${t.topY}  outer x ${t.outX}  ${t.hex}` +
      `   ${t.outX > c.flankHalfWidth ? `PROUD of flank by ${(t.outX-c.flankHalfWidth).toFixed(3)}` : 'inboard of flank'}`);
  if (c.darkAboveTyre.length) console.log(`   dark bodies above 0.2 m: ${c.darkAboveTyre.slice(0,4).map(q=>`y ${q.y0}…${q.y1}`).join('  ')}`);
}
writeFileSync('shots/arch2.json', JSON.stringify(out,null,2));
await b.close();
