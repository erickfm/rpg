// Independent check of "one masonry density": for every textured mesh, pair the
// texture canvas with the face it is mapped to and report px/m on BOTH axes.
// A single density means every wall lands on the same pair of numbers.
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
await p.goto('http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(1200);
const r = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const rows = [];
  s.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    for (let q=o;q;q=q.parent) if (q.visible===false) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); if (!g.boundingBox) return;
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const sz = [bb.max.x-bb.min.x, bb.max.y-bb.min.y, bb.max.z-bb.min.z];
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    // BoxGeometry material order [+x,-x,+y,-y,+z,-z]; the two side faces that
    // carry a facade are index 0/1 (face = depth x height) and 4/5 (width x height)
    mats.forEach((m, i) => {
      if (!m || !m.map || !m.map.image) return;
      const iw = m.map.image.width, ih = m.map.image.height;
      if (!iw || !ih) return;
      let fw, fh;
      if (g.type === 'BoxGeometry') {
        if (i === 0 || i === 1) { fw = sz[2]; fh = sz[1]; }
        else if (i === 4 || i === 5) { fw = sz[0]; fh = sz[1]; }
        else { fw = sz[0]; fh = sz[2]; }
      } else { // planes: the two non-zero extents
        const nz = [0,1,2].filter(k => sz[k] > 1e-4);
        if (nz.length < 2) return;
        fw = sz[nz[0]]; fh = sz[nz[1]];
        if (nz.includes(1)) { fh = sz[1]; fw = sz[nz.find(k=>k!==1)]; }
      }
      const rep = [m.map.repeat.x, m.map.repeat.y];
      rows.push({ geo: g.type, mi: i, img: [iw, ih], face: [+fw.toFixed(2), +fh.toFixed(2)],
        ppmX: +((iw * (rep[0]||1)) / fw).toFixed(2), ppmY: +((ih * (rep[1]||1)) / fh).toFixed(2),
        c: [(bb.min.x+bb.max.x)/2, (bb.min.y+bb.max.y)/2, (bb.min.z+bb.max.z)/2].map(v=>+v.toFixed(1)) });
    });
  });
  return rows;
});
// walls only: tall exterior faces on the street, x within the block
const walls = r.filter(x => x.face[1] > 3 && x.c[0] < 100 && x.img[0] > 20);
const key = x => `${x.ppmX} x ${x.ppmY}`;
const groups = {};
for (const w of walls) (groups[key(w)] ??= []).push(w);
console.log(`textured faces: ${r.length}   wall-sized exterior faces: ${walls.length}\n`);
console.log('px/m groups (across x up):');
for (const [k, v] of Object.entries(groups).sort((a,b)=>b[1].length-a[1].length))
  console.log(`  ${String(v.length).padStart(3)} x   ${k}    e.g. face ${v[0].face.join('x')} m, canvas ${v[0].img.join('x')} at (${v[0].c.join(', ')})`);
await b.close();
