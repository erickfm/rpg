// FIND PEOPLE by what they are now, not by the sprite-sheet width I remember.
// The 320-wide signature matches nothing since c16457c8. Rather than guess a new
// constant, enumerate every candidate upright figure-sized thing and describe it,
// then answer the real question: does it TURN, or is it one flat card?
//
// The turn test is structural, not photographic. Orbit the camera around a
// figure and watch its material's map offset / rotation / the mesh's own yaw.
// Something that presents 8 angles must change one of those; a flat plane that
// merely billboards will change its yaw but never its frame.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
await p.goto('http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);

const cens = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const cand = [];
  const byMapW = {};
  s.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    for (let q = o; q; q = q.parent) if (q.visible === false) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); if (!g.boundingBox) return;
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const h = bb.max.y - bb.min.y, w = bb.max.x - bb.min.x, d = bb.max.z - bb.min.z;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m || !m.map || !m.map.image) return;
    const mw = m.map.image.width, mh = m.map.image.height;
    byMapW[`${mw}x${mh}`] = (byMapW[`${mw}x${mh}`] || 0) + 1;
    // figure-sized: 1.4-2.1 m tall, under 1.2 m in both plan axes, standing on the ground
    if (h < 1.35 || h > 2.15) return;
    if (w > 1.2 || d > 1.2) return;
    if (bb.min.y > 0.6) return;
    cand.push({ x: +((bb.min.x+bb.max.x)/2).toFixed(2), y: +((bb.min.y+bb.max.y)/2).toFixed(2),
      z: +((bb.min.z+bb.max.z)/2).toFixed(2), h: +h.toFixed(2), w: +w.toFixed(2), d: +d.toFixed(2),
      map: `${mw}x${mh}`, geom: o.geometry.type, uuid: o.uuid,
      rep: [+m.map.repeat.x.toFixed(3), +m.map.repeat.y.toFixed(3)],
      off: [+m.map.offset.x.toFixed(3), +m.map.offset.y.toFixed(3)],
      interior: bb.min.x > 400 });
  });
  return { cand, byMapW: Object.entries(byMapW).sort((a,c)=>c[1]-a[1]).slice(0,10) };
});
console.log('mapped-texture sizes in the world (top 10):');
for (const [k, n] of cens.byMapW) console.log(`   ${String(n).padStart(5)}  ${k}`);
console.log(`\nfigure-sized candidates: ${cens.cand.length}  (${cens.cand.filter(c=>c.interior).length} interior)`);
const sizes = {};
for (const c of cens.cand) sizes[`${c.map} ${c.geom} ${c.h}m`] = (sizes[`${c.map} ${c.geom} ${c.h}m`]||0)+1;
for (const [k,n] of Object.entries(sizes).sort((a,c)=>c[1]-a[1]).slice(0,12)) console.log(`   ${String(n).padStart(4)}  ${k}`);
console.log('\nfirst few:');
for (const c of cens.cand.slice(0,5)) console.log(`   ${c.h}m ${c.w}×${c.d} map ${c.map} rep ${c.rep} off ${c.off} at (${c.x},${c.z}) ${c.interior?'INTERIOR':''}`);
writeFileSync('shots/people.json', JSON.stringify(cens, null, 2));
await b.close();
