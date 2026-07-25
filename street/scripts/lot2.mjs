// Shots from inside the lot, each from a standable point with verified landing.
// Also: is there an office at the back? Find building-scale structures inside
// the lot's own bounds rather than assuming one.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 780 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, process.env.SHOT_URL ?? 'http://localhost:4184/');   // GOTCHAS 26: prove it, do not just name it
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(800);
const info = await p.evaluate(() => {
  const s=window.__ct.scene(); s.updateMatrixWorld(true);
  const L={x0:7.2,x1:40,z0:15,z1:-10};   // the real lot: placeLot is 23.2 m on the east frontage
  const built=[];
  s.traverse(o=>{ if(!o.isMesh||!o.geometry)return;
    for(let q=o;q;q=q.parent) if(q.visible===false) return;
    const g=o.geometry; if(!g.boundingBox)g.computeBoundingBox(); if(!g.boundingBox)return;
    const bb=g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if(bb.max.x>400)return;
    const cx=(bb.min.x+bb.max.x)/2, cz=(bb.min.z+bb.max.z)/2, h=bb.max.y-bb.min.y;
    if(cx<L.x0||cx>L.x1||cz<L.z1||cz>L.z0)return;
    if(h<1.8||h>9)return;
    const w=bb.max.x-bb.min.x, d=bb.max.z-bb.min.z;
    if(w<2||d<2)return;
    built.push({w:+w.toFixed(1),h:+h.toFixed(1),d:+d.toFixed(1),cx:+cx.toFixed(1),cz:+cz.toFixed(1),y0:+bb.min.y.toFixed(2)});});
  return built.sort((a,c)=>(c.w*c.d)-(a.w*a.d)).slice(0,10);
});
console.log('structures 1.8-9 m tall inside the lot bounds, biggest footprint first:');
for(const t of info) console.log(`   ${t.w}×${t.h}×${t.d}  at (${t.cx}, ${t.cz})  base y ${t.y0}`);

const SHOTS = [
  ['lot2-in-east', 10.5, 2.5, 'inside the lot at the street end, looking east to the back'],
  ['lot2-in-west', 22.0, 2.5, 'from the back of the lot, looking west to the street'],
  ['lot2-rows',    16.0, 2.5, 'mid-lot, looking north across it'],
];
for (const [label, x, z, expect] of SHOTS) {
  const r = await p.evaluate(([x,z,label]) => {
    const RAD=0.36, cols=window.__ct.colliders().filter(c=>c&&isFinite(c.minX)&&Math.abs(c.minX)<500);
    const free=(a,c)=>!cols.some(k=>a>k.minX-RAD&&a<k.maxX+RAD&&c>k.minZ-RAD&&c<k.maxZ+RAD);
    if(!free(x,z)) return {ok:false,why:'not standable'};
    const yaw = label.endsWith('east') ? Math.PI/2 : label.endsWith('west') ? -Math.PI/2 : 0;
    window.__ct.warp(x,z,yaw,0.14,0.02);
    return {ok:true};
  }, [x,z,label]);
  if(!r.ok){ console.log(`   MISS ${label}: ${r.why}`); continue; }
  await p.waitForTimeout(280);
  const q = await p.evaluate(()=>window.__ct.pos());
  const landed = Math.abs(q[0]-x)<0.06 && Math.abs(q[2]-z)<0.06;
  await p.screenshot({path:`shots/${label}.png`});
  console.log(`   ${landed?'shot ':'DRIFT'} ${label} from (${x}, ${z}) — expect: ${expect}`);
}
writeFileSync('shots/lot2.json', JSON.stringify(info,null,2));
await b.close();
