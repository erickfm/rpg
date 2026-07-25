// E reports the church flight walkable to gy 0.55. My grid walk of x -10..16,
// z -102..-120 found 786 free points and NOTHING above 0.20 m. My scan box came
// from memory, so it is the suspect, not E's report.
//
// Find the church from the source, find the tread geometry from the source, and
// walk only that. A grid scan wide enough to be safe is too slow to finish; a
// scan aimed at slabs that actually exist is both faster and honest about where
// it looked.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 750 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(800);

const out = await p.evaluate(async () => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const big = [], treads = [];
  s.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    for (let q = o; q; q = q.parent) if (q.visible === false) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); if (!g.boundingBox) return;
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if (bb.max.x > 400) return;                       // interiors live off-world
    const h = bb.max.y - bb.min.y, w = bb.max.x - bb.min.x, d = bb.max.z - bb.min.z;
    if (h >= 5) big.push({ x0:+bb.min.x.toFixed(1), x1:+bb.max.x.toFixed(1),
      z0:+bb.min.z.toFixed(1), z1:+bb.max.z.toFixed(1), h:+h.toFixed(1) });
    // a tread: broad, flat, standing between ankle and waist height
    if (h < 0.9 && bb.min.y > 0.05 && bb.min.y < 1.6 && w > 0.8 && d > 0.5 && w * d > 1.2)
      treads.push({ x0:+bb.min.x.toFixed(2), x1:+bb.max.x.toFixed(2), z0:+bb.min.z.toFixed(2),
        z1:+bb.max.z.toFixed(2), y:+bb.min.y.toFixed(2), top:+bb.max.y.toFixed(2) });
  });
  const south = big.filter(t => t.z1 < -95).sort((a,c)=>c.h-a.h);
  const sTreads = treads.filter(t => t.x0 < 400).sort((a,c)=>a.y-c.y);   // EVERY flight in the world

  // walk the treads that exist, centre of each, verified landing
  const RAD = 0.36;
  const cols = window.__ct.colliders().filter(c=>c&&isFinite(c.minX)&&Math.abs(c.minX)<500);
  const free = (x,z)=>!cols.some(c=>x>c.minX-RAD&&x<c.maxX+RAD&&z>c.minZ-RAD&&z<c.maxZ+RAD);
  const walked = [];
  for (const t of sTreads.slice(0, 90)) {
    const cx = (t.x0+t.x1)/2, cz = (t.z0+t.z1)/2;
    if (!free(cx, cz)) { walked.push({ ...t, gy: null, why: 'inside a collider' }); continue; }
    window.__ct.warp(cx, cz, 0, 0.14, 0);
    await new Promise(r=>requestAnimationFrame(r)); await new Promise(r=>requestAnimationFrame(r));
    const q = window.__ct.pos();
    if (Math.abs(q[0]-cx)>0.05 || Math.abs(q[2]-cz)>0.05) { walked.push({...t, gy:null, why:'warp rejected'}); continue; }
    walked.push({ ...t, cx:+cx.toFixed(2), cz:+cz.toFixed(2), gy:+q[3].toFixed(2) });
  }
  return { south: south.slice(0,10), nTreads: sTreads.length, walked };
});

console.log('building-scale meshes south of z = -95, tallest first:');
for (const t of out.south) console.log(`   h${String(t.h).padStart(5)}  x ${t.x0} … ${t.x1}   z ${t.z0} … ${t.z1}`);
console.log(`\n${out.nTreads} tread-shaped slabs in the WORLD (flat, 0.05-1.6 m up, over 1.2 m2)`);
console.log('walked, centre of each, landing verified:');
for (const w of out.walked)
  console.log(`   y ${String(w.y).padStart(5)} top ${String(w.top).padStart(5)}  x ${w.x0}…${w.x1} z ${w.z0}…${w.z1}  ` +
    (w.gy === null ? `- ${w.why}` : `stood at gy ${w.gy}`));
const gys = out.walked.filter(w=>w.gy!==null).map(w=>w.gy);
console.log(`\nmax gy actually stood on down there: ${gys.length ? Math.max(...gys) : 'nothing walkable'}`);
writeFileSync('shots/church.json', JSON.stringify(out, null, 2));
await b.close();
