// HANDEDNESS INSIDE THE ROOMS. My handed.mjs only ever looked at the street
// (upright mapped faces above 1.2 m, exterior). Mainline reports the mirror
// harness was dev-only and covered three of eight rooms, and that PAWN reads
// wrong -- so check all eight independently, with the geometric test rather
// than by reading letters.
//
//   normal = the plane's +z in world · uDir = its +x · right = cross(up, normal)
//   correct iff dot(uDir, right) > 0
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(aim('http://localhost:4184/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p);
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);
const out = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const ROOMS = ['bodega','burger','casino','diner','hotel','pawn','tax','thrift'];
  const rows = [];
  const tf = (o, v) => { const e=o.matrixWorld.elements;
    const x=e[0]*v.x+e[4]*v.y+e[8]*v.z, y=e[1]*v.x+e[5]*v.y+e[9]*v.z, z=e[2]*v.x+e[6]*v.y+e[10]*v.z;
    const L=Math.hypot(x,y,z)||1; return {x:x/L,y:y/L,z:z/L}; };
  s.traverse(o => {
    if (!o.isMesh || !o.geometry || o.geometry.type !== 'PlaneGeometry') return;
    for (let q=o;q;q=q.parent) if (q.visible===false) return;
    const m = Array.isArray(o.material)?o.material[0]:o.material;
    if (!m || !m.map || !m.map.image) return;
    const g=o.geometry; if(!g.boundingBox)g.computeBoundingBox();
    const bb=g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const cx=(bb.min.x+bb.max.x)/2;
    if (cx < 400) return;                                  // interiors only
    const slab = Math.floor((cx-400)/80);
    if (slab < 0 || slab > 7) return;
    if (bb.max.y - bb.min.y < 0.35) return;                // skip tiny decals
    const up = tf(o,{x:0,y:1,z:0}); if (Math.abs(up.y) < 0.7) return;   // uprights only
    const N = tf(o,{x:0,y:0,z:1}), U = tf(o,{x:1,y:0,z:0});
    const dot = U.x*N.z + U.z*(-N.x);
    rows.push({ room: ROOMS[slab], mirrored: dot < -0.001, dot:+dot.toFixed(2),
      size:[+(bb.max.x-bb.min.x).toFixed(2),+(bb.max.y-bb.min.y).toFixed(2),+(bb.max.z-bb.min.z).toFixed(2)],
      canvas:[m.map.image.width, m.map.image.height],
      at:[+cx.toFixed(1),+((bb.min.y+bb.max.y)/2).toFixed(2),+((bb.min.z+bb.max.z)/2).toFixed(2)] });
  });
  return rows;
});
const byRoom = {};
for (const r of out) { const b2 = byRoom[r.room] ??= { n:0, bad:0, examples:[] };
  b2.n++; if (r.mirrored) { b2.bad++; if (b2.examples.length<3) b2.examples.push(r); } }
console.log(`${out.length} upright mapped faces inside the eight rooms\n`);
console.log('room      faces   MIRRORED');
for (const k of ['bodega','burger','casino','diner','hotel','pawn','tax','thrift']) {
  const v = byRoom[k]; if (!v) { console.log(`${k.padEnd(9)}     0`); continue; }
  console.log(`${k.padEnd(9)} ${String(v.n).padStart(5)}   ${v.bad ? '** '+v.bad+' **' : '0'}`);
}
for (const k of Object.keys(byRoom)) for (const e of byRoom[k].examples)
  console.log(`   ${k}: ${e.size.join('×')} canvas ${e.canvas.join('×')} at (${e.at.join(', ')}) dot ${e.dot}`);
writeFileSync('shots/handedint.json', JSON.stringify(out,null,2));
await b.close();
