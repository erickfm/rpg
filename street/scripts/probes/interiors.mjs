// INTERIOR AUDIT — judge the rooms as a SET, not each against its own brief.
// Measures the axes the queue names (ceiling, doorway, wall thickness, floor
// density, light, way out) for every interior region, then walks the entry and
// exit of each to test the two things a builder cannot see from inside.
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { writeFileSync } from 'node:fs';
const REGIONS = [
  { id: 'apartment (pre-kit)', x0: 100, x1: 230 },
  { id: 'bodega (pre-kit)',    x0: 230, x1: 260 },
  { id: 'slab 0', x0: 400, x1: 480 },
  { id: 'slab 1', x0: 480, x1: 560 },
  { id: 'slab 2', x0: 560, x1: 640 },
  { id: 'slab 3', x0: 640, x1: 720 },
  { id: 'slab 4', x0: 720, x1: 800 },
  { id: 'slab 5', x0: 800, x1: 880 },
  { id: 'slab 6', x0: 880, x1: 960 },
];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
const warns = [];
p.on('console', m => { if (m.type() === 'warning' || /interior:/.test(m.text())) warns.push(m.text()); });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, process.env.SHOT_URL ?? 'http://localhost:4184/');   // GOTCHAS 26: prove it, do not just name it
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(1200);

const measured = await p.evaluate((REGIONS) => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const lum = h => { const r=(h>>16&255)/255,g=(h>>8&255)/255,b2=(h&255)/255;
    return +(0.2126*r+0.7152*g+0.0722*b2).toFixed(3); };
  const out = [];
  for (const R of REGIONS) {
    const items = [];
    s.traverse(o => {
      if (!o.isMesh || !o.geometry) return;
      for (let q=o;q;q=q.parent) if (q.visible===false) return;
      const g=o.geometry; if(!g.boundingBox) g.computeBoundingBox(); if(!g.boundingBox) return;
      const bb=g.boundingBox.clone().applyMatrix4(o.matrixWorld);
      const c=[(bb.min.x+bb.max.x)/2,(bb.min.y+bb.max.y)/2,(bb.min.z+bb.max.z)/2];
      if (c[0] < R.x0 || c[0] >= R.x1) return;
      const m = Array.isArray(o.material)?o.material[0]:o.material;
      items.push({ geo:g.type, sz:[bb.max.x-bb.min.x,bb.max.y-bb.min.y,bb.max.z-bb.min.z],
        min:[bb.min.x,bb.min.y,bb.min.z], max:[bb.max.x,bb.max.y,bb.max.z], c,
        col: m&&m.color?m.color.getHex():null, map: m&&m.map&&m.map.image?[m.map.image.width,m.map.image.height,m.map.repeat.x,m.map.repeat.y]:null,
        add: !!(m&&m.blending===2), localX: o.position.x });
    });
    if (!items.length) { out.push({ id:R.id, empty:true }); continue; }
    // the floor: the largest near-horizontal mesh low down
    const flats = items.filter(i=>i.sz[1]<0.06 && i.sz[0]>1 && i.sz[2]>1);
    const floor = flats.filter(i=>i.c[1]<1.0).sort((a,b2)=>b2.sz[0]*b2.sz[2]-a.sz[0]*a.sz[2])[0];
    const ceils = flats.filter(i=>i.c[1]>1.6).sort((a,b2)=>b2.sz[0]*b2.sz[2]-a.sz[0]*a.sz[2]);
    const ceil = ceils[0];
    const walls = items.filter(i=>i.sz[1]>1.5 && (i.sz[0]<0.5||i.sz[2]<0.5) && !i.add);
    const thick = walls.map(w=>+Math.min(w.sz[0],w.sz[2]).toFixed(3)).sort();
    const glows = items.filter(i=>i.add);
    out.push({ id:R.id, meshes:items.length,
      floorY: floor?+floor.c[1].toFixed(3):null,
      clear: floor?[+floor.sz[0].toFixed(2),+floor.sz[2].toFixed(2)]:null,
      ceilY: ceil?+ceil.c[1].toFixed(2):null,
      ceilTextured: ceil? !!ceil.map : null,
      ceilCol: ceil&&ceil.col!=null?'#'+ceil.col.toString(16).padStart(6,'0'):null,
      ceilLum: ceil&&ceil.col!=null?lum(ceil.col):null,
      floorPPM: floor&&floor.map?[+(floor.map[0]*floor.map[2]/floor.sz[0]).toFixed(1),+(floor.map[1]*floor.map[3]/floor.sz[2]).toFixed(1)]:null,
      wallThickness: [...new Set(thick)],
      wallPPM: (()=>{ const w=walls.find(x=>x.map); if(!w) return null;
        const len=Math.max(w.sz[0],w.sz[2]);
        return [+(w.map[0]*w.map[2]/len).toFixed(1), +(w.map[1]*w.map[3]/w.sz[1]).toFixed(1)]; })(),
      wallLum: (()=>{ const w=walls.find(x=>x.col!=null); return w?lum(w.col):null; })(),
      glows: glows.length,
      // group discipline: kit rooms must hold WORLD x on their children
      childrenWithLocalX: items.filter(i=>Math.abs(i.localX)<100).length,
    });
  }
  return out;
}, REGIONS);

// walk tests: can you reach each way-in spot, and is each landing point legal?
const walk = await p.evaluate(async () => {
  const res = [];
  const look=(x,z,tx,tz)=>Math.atan2(tx-x,-(tz-z));
  const prompt=()=>{const e=[...document.querySelectorAll('*')].find(n=>n.children.length===0&&/\[E\]/.test(n.textContent??''));
    return e&&e.offsetParent!==null?e.textContent.trim():null;};
  const drive=async(fx,fz,tx,tz,gy,n=150)=>{
    window.__ct.warp(fx,fz,look(fx,fz,tx,tz),gy,0);
    await new Promise(r=>setTimeout(r,120));
    let best=Infinity,seen=null;
    for(let i=0;i<n;i++){window.dispatchEvent(new KeyboardEvent('keydown',{key:'w'}));
      await new Promise(r=>requestAnimationFrame(r));
      const q=window.__ct.pos(); best=Math.min(best,Math.hypot(q[0]-tx,q[2]-tz));
      const t=prompt(); if(t) seen=t;}
    window.dispatchEvent(new KeyboardEvent('keyup',{key:'w'}));
    const q=window.__ct.pos();
    return {closest:+best.toFixed(2), end:[+q[0].toFixed(2),+q[2].toFixed(2)], prompt:seen};
  };
  // DINER way-in spot is at (-6.55, DZ). Approach along the west walk both ways.
  const DX=-6.55;
  for (const dz of [9.6]) {
    res.push({test:`diner entry, from the north along the west walk`, ...await drive(-6.2, dz+6, DX, dz, 0.14)});
    res.push({test:`diner entry, from the south along the west walk`, ...await drive(-6.2, dz-6, DX, dz, 0.14)});
    res.push({test:`diner entry, straight in off the road`,           ...await drive(-4.2, dz,   DX, dz, 0)});
  }
  // is the landing point legal? warp there, then try to step 8 ways.
  const stuck=async(x,z,gy,label)=>{
    const keys=['w','s','a','d'];
    let moved=0;
    for(const k of keys){
      window.__ct.warp(x,z,0,gy,0); await new Promise(r=>setTimeout(r,60));
      const a=window.__ct.pos();
      for(let i=0;i<25;i++){window.dispatchEvent(new KeyboardEvent('keydown',{key:k}));
        await new Promise(r=>requestAnimationFrame(r));}
      window.dispatchEvent(new KeyboardEvent('keyup',{key:k}));
      const b2=window.__ct.pos();
      if(Math.hypot(b2[0]-a[0],b2[2]-a[2])>0.15) moved++;
    }
    return {test:label, at:[x,z], directionsFree:`${moved}/4`};
  };
  res.push(await stuck(-6.1, 9.6-1.5, 0.14, 'diner exit landing — can you move off it?'));
  res.push(await stuck(11, -97.3, 0.14, 'bodega exit landing — can you move off it?'));
  return res;
});

writeFileSync('shots/interior-report.json', JSON.stringify({ measured, walk, warns }, null, 2));
console.log('=== MEASURED ===');
for (const m of measured) console.log(JSON.stringify(m));
console.log('\n=== WALK ===');
for (const w of walk) console.log(JSON.stringify(w));
console.log('\n=== CONSOLE WARNINGS FROM THE KIT ===');
console.log(warns.length ? warns.join('\n') : '(none)');
await b.close();
