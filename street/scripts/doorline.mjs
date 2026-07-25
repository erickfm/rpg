// Is each [E] prompt ON the facade door it names, or beside it?
//
// The prompt spans below are MEASURED, from the doorsweep run minutes ago --
// doorsweep finds doors by walking and carries no coordinates. The door
// GEOMETRY is found here from the scene by shape. The check is the offset
// between the two centres, along the walk.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const PROMPTS = [
  ['BODEGA',        'east', -96.00, -94.75], ['PAWN SHOP',    'east', -61.50, -59.50],
  ['No. 227',       'east', -45.00, -43.00], ['A-1 TAX',      'east', -21.00, -19.25],
  ['THRIFT STORE',  'west', -60.25, -58.50], ['DINER',        'west', -47.50, -45.75],
  ['BURGER BARN',   'west', -26.00, -24.25],
];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(800);
const out = await p.evaluate((PROMPTS) => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const doors = [];
  s.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    for (let q=o;q;q=q.parent) if (q.visible===false) return;
    const g=o.geometry; if(!g.boundingBox)g.computeBoundingBox(); if(!g.boundingBox)return;
    const bb=g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if (bb.max.x > 400) return;
    // a citizen is exactly door-shaped: 1.9 m tall, 0.9 m wide, on the ground.
    // The 160x128 atlas is what tells them apart, and the walk centreline (x=+-6)
    // is where they stand -- a facade door is at the facade.
    const mm = Array.isArray(o.material) ? o.material[0] : o.material;
    if (mm && mm.map && mm.map.image && mm.map.image.width === 160) return;
    const h=bb.max.y-bb.min.y, w=bb.max.x-bb.min.x, d=bb.max.z-bb.min.z;
    // door leaf: stands on the ground, head between 1.9 and 2.9 m, ~0.8-2.4 m wide
    if (bb.min.y > 0.45 || bb.max.y < 1.9 || bb.max.y > 2.9) return;
    const along = Math.max(w, d);
    if (along < 0.7 || along > 2.6) return;
    doors.push({ cx:+((bb.min.x+bb.max.x)/2).toFixed(2), cz:+((bb.min.z+bb.max.z)/2).toFixed(2),
      w:+w.toFixed(2), d:+d.toFixed(2), h:+h.toFixed(2), top:+bb.max.y.toFixed(2) });
  });
  const res = [];
  for (const [name, line, z0, z1] of PROMPTS) {
    const zc = (z0+z1)/2;
    const near = doors.filter(q => (line==='east' ? q.cx > 5.5 && q.cx < 9.5 : q.cx < -5.5 && q.cx > -9.5)
      && Math.abs(q.cz - zc) < 4.0 && Math.abs(Math.abs(q.cx) - 6.0) > 0.35)   // not the walk centreline
      .sort((a,c)=>Math.abs(a.cz-zc)-Math.abs(c.cz-zc));
    res.push({ name, line, promptZ: +zc.toFixed(2), promptSpan: [z0, z1],
      nNear: near.length, best: near[0] || null, all: near.slice(0,3),
      offset: near[0] ? +(near[0].cz - zc).toFixed(2) : null });
  }
  return { nDoors: doors.length, res };
}, PROMPTS);
console.log(`${out.nDoors} door-leaf-shaped meshes on the facades\n`);
console.log('prompt          walk   prompt centre   nearest door leaf     offset   verdict');
for (const r of out.res) {
  if (!r.best) { console.log(`${r.name.padEnd(15)} ${r.line.padEnd(6)} z ${String(r.promptZ).padStart(7)}   none within 4 m       —       NO LEAF FOUND`); continue; }
  const v = Math.abs(r.offset) <= 0.45 ? 'on the door' : Math.abs(r.offset) <= 1.0 ? 'edge of the door' : 'OFF THE DOOR';
  console.log(`${r.name.padEnd(15)} ${r.line.padEnd(6)} z ${String(r.promptZ).padStart(7)}   x ${String(r.best.cx).padStart(5)} z ${String(r.best.cz).padStart(7)}  ${String(r.offset).padStart(6)} m   ${v}`);
  if (r.all.length > 1) console.log(`${''.padEnd(22)}other leaves near: ${r.all.slice(1).map(q=>`x${q.cx} z${q.cz}`).join('  ')}`);
}
writeFileSync('shots/doorline.json', JSON.stringify(out,null,2));
await b.close();
