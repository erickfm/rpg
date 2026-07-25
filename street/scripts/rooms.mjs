// THE INTERIORS AS A SET, measured structurally. No cameras and no remembered
// coordinates: rooms are found by walking the interior belt (x >= 400, 80 m
// slabs) and asking each slab what is in it. scripts/intcompare.mjs hardcodes
// three rooms and there are eight -- the stale-coordinate defect again.
//
// The question this audit exists for is not "is each room good" but "do the
// eight agree with each other", so every number below is comparable across the
// row and the spread is the finding.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);
const out = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const modOf = o => { for (let q=o;q;q=q.parent) if (q.userData && q.userData.mod) return q.userData.mod; return null; };
  const rooms = [];
  for (let i = 0; i < 12; i++) {
    const X0 = 400 + i*80, X1 = X0 + 80;
    const items = [];
    s.traverse(o => { if(!o.isMesh||!o.geometry) return;
      for(let q=o;q;q=q.parent) if(q.visible===false) return;
      const g=o.geometry; if(!g.boundingBox)g.computeBoundingBox(); if(!g.boundingBox)return;
      const bb=g.boundingBox.clone().applyMatrix4(o.matrixWorld);
      const cx=(bb.min.x+bb.max.x)/2; if(cx<X0||cx>=X1) return;
      const m=Array.isArray(o.material)?o.material[0]:o.material;
      const img=m&&m.map&&m.map.image;
      items.push({ bb:{x0:bb.min.x,x1:bb.max.x,y0:bb.min.y,y1:bb.max.y,z0:bb.min.z,z1:bb.max.z},
        w:bb.max.x-bb.min.x, h:bb.max.y-bb.min.y, d:bb.max.z-bb.min.z,
        lum: m&&m.color ? 0.299*m.color.r+0.587*m.color.g+0.114*m.color.b : null,
        iw: img?img.width:0, ih: img?img.height:0, mod: modOf(o) }); });
    if (items.length < 20) continue;
    // floor + ceiling: the big flat horizontals, lowest and highest
    const flats = items.filter(q => q.h < 0.25 && q.w > 2 && q.d > 2).sort((a,c)=>a.bb.y0-c.bb.y0);
    if (!flats.length) continue;
    const floor = flats[0], ceil = flats[flats.length-1];
    const dens = q => (q.iw && q.w>0.2 && q.d>0.2) ? [ +(q.iw/Math.max(q.w,q.d)).toFixed(1), +(q.ih/Math.min(q.w,q.d)).toFixed(1) ] : null;
    // walls: upright planes/boxes tall enough to be walls
    const walls = items.filter(q => q.h > 1.6 && (q.w < 0.4 || q.d < 0.4) && Math.max(q.w,q.d) > 1.5);
    const thick = walls.map(q => +Math.min(q.w, q.d).toFixed(3)).filter(v => v > 0.001);
    rooms.push({ slab: i, x0: X0, n: items.length,
      ceilY: +ceil.bb.y0.toFixed(2), floorY: +floor.bb.y0.toFixed(2),
      height: +(ceil.bb.y0 - floor.bb.y0).toFixed(2),
      footprint: [ +Math.max(floor.w, floor.d).toFixed(1), +Math.min(floor.w, floor.d).toFixed(1) ],
      floorDens: dens(floor), ceilLum: ceil.lum!==null?+ceil.lum.toFixed(3):null,
      floorLum: floor.lum!==null?+floor.lum.toFixed(3):null,
      wallThick: thick.length ? +(thick.reduce((a,c)=>a+c,0)/thick.length).toFixed(3) : null,
      nWalls: walls.length, mods: [...new Set(items.map(q=>q.mod).filter(Boolean))] });
  }
  return rooms;
});
console.log(`${out.length} rooms in the interior belt\n`);
console.log('slab  x0    meshes  ceiling  height  footprint     floor px/m   ceilLum  floorLum  wallThick');
for (const r of out)
  console.log(`  ${String(r.slab).padStart(2)}  ${String(r.x0).padStart(4)}   ${String(r.n).padStart(4)}   ` +
    `${String(r.ceilY).padStart(5)}   ${String(r.height).padStart(5)}   ${String(r.footprint.join('×')).padEnd(11)}  ` +
    `${String(r.floorDens?r.floorDens.join('×'):'—').padEnd(11)}  ${String(r.ceilLum).padStart(6)}   ${String(r.floorLum).padStart(6)}    ${r.wallThick ?? '—'}`);
const sp = (k, f) => { const v = out.map(f).filter(x=>x!=null); return v.length? `${Math.min(...v)} … ${Math.max(...v)}  (spread ${(Math.max(...v)-Math.min(...v)).toFixed(2)}, ratio ${(Math.max(...v)/Math.min(...v)).toFixed(2)}×)` : '—'; };
console.log(`\nceiling height  ${sp('h', r=>r.height)}`);
console.log(`ceiling lum     ${sp('l', r=>r.ceilLum)}`);
console.log(`floor lum       ${sp('l', r=>r.floorLum)}`);
console.log(`wall thickness  ${sp('t', r=>r.wallThick)}`);
console.log(`floor px/m (u)  ${sp('d', r=>r.floorDens?r.floorDens[0]:null)}`);
writeFileSync('shots/rooms.json', JSON.stringify(out,null,2));
await b.close();
