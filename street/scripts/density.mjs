// Independent check of "one masonry density": for every textured mesh, pair the
// texture canvas with the face it is mapped to and report px/m on BOTH axes.
// A single density means every wall lands on the same pair of numbers.
//
// Face size comes from the mesh's LOCAL geometry parameters scaled by its world
// scale — NOT from a world bounding box. The bounding box is wrong the moment
// anything sits in a rotated group: the x and z extents swap, so a face gets
// measured against the wrong edge. That mis-reported the bodega canted bay
// (rotated 135 degrees) as 11.5 x 11.7 when it is 8.13, and the whole church
// (ct/street.ts placeChurchEast rotates the group -90) as 10.81 / 5.92 / 30.59
// when every face of it is 8.00. Both were chased as real defects before the
// tool was suspected. Local dimensions have no such ambiguity.
// --selftest: break one stamp on purpose and require this to go red.
//
// This reports 0 mismatches, and a check that reports 0 is indistinguishable
// from a check that has stopped working. The mutation is applied at RUNTIME to
// one texture's declaration, so nothing on disk changes and the world is not
// touched: a stamp claims it was painted for a width it was not.
import { chromium } from 'playwright';
const SELFTEST = process.argv.includes('--selftest');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(1200);
if (SELFTEST) {
  const hit = await p.evaluate(() => {
    let n = 0;
    window.__ct.scene().traverse((o) => {
      if (n || !o.isMesh) return;
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
        const d = m?.map?.userData?.masonry;
        if (!d || n) continue;
        d.wMeters = d.wMeters * 1.4;      // painted for one width, mapped to another
        n++;
      }
    });
    return n;
  });
  console.log(`selftest: corrupted ${hit} masonry declaration — this MUST now go red`);
}
const r = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const rows = [];
  s.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    for (let q=o;q;q=q.parent) if (q.visible===false) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); if (!g.boundingBox) return;
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);   // for reporting position only
    // world scale off the matrix basis vectors, so rotation cannot leak in
    const e = o.matrixWorld.elements;
    const len = (a, b, c) => Math.hypot(e[a], e[b], e[c]);
    const S = [len(0,1,2), len(4,5,6), len(8,9,10)];
    const par = g.parameters ?? {};
    const local = par.width !== undefined
      ? [par.width * S[0], (par.height ?? 0) * S[1], (par.depth ?? 0) * S[2]]
      : [ (bb.max.x-bb.min.x), (bb.max.y-bb.min.y), (bb.max.z-bb.min.z) ];  // fallback: unparameterised
    const sz = local;
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
      } else if (par.width !== undefined) {   // PlaneGeometry: local w x h, always
        fw = sz[0]; fh = sz[1];
      } else {                                 // unparameterised: fall back to extents
        const nz = [0,1,2].filter(k => sz[k] > 1e-4);
        if (nz.length < 2) return;
        fw = sz[nz[0]]; fh = sz[nz[1]];
        if (nz.includes(1)) { fh = sz[1]; fw = sz[nz.find(k=>k!==1)]; }
      }
      const rep = [m.map.repeat.x, m.map.repeat.y];
      const dec = m.map.userData?.masonry ?? null;   // what masonry() declared
      rows.push({ geo: g.type, mi: i, img: [iw, ih], face: [+fw.toFixed(2), +fh.toFixed(2)], dec,
        ppmX: +((iw * (rep[0]||1)) / fw).toFixed(2), ppmY: +((ih * (rep[1]||1)) / fh).toFixed(2),
        c: [(bb.min.x+bb.max.x)/2, (bb.min.y+bb.max.y)/2, (bb.min.z+bb.max.z)/2].map(v=>+v.toFixed(1)) });
    });
  });
  return rows;
});
// ── SELECT BY DECLARATION, NOT BY SHAPE ────────────────────────────────────
//
// The geometric net below — tall, on the street, big enough canvas — is what
// AUDIT-TRIAGE.md calls out: foliage, ground decals and signage all fall into a
// net meant for masonry, and no amount of shape-guessing separates them.
// ct/tex-world.ts now stamps every texture masonry() paints, so the primary
// answer asks instead of guesses.
//
// And it asks a better question. Grouping MEASURED px/m only ever finds
// disagreement between this file's arithmetic and the painter's. The real
// assertion of pattern #1 is that the face a texture lands on is the face it
// was painted for — a canvas painted for 18 m stretched onto 12 m is a density
// violation that no px/m grouping can name, because it just looks like another
// group.
const declared = r.filter(x => x.dec);
const bad = [];
for (const x of declared) {
  const d = x.dec;
  // the stamp records the metres masonry() was given; compare with the face it
  // actually reached. 2 % tolerance absorbs the canvas rounding masonry() does
  // (it rounds W and H to whole texels), nothing more.
  const dw = Math.abs(x.face[0] - d.wMeters) / Math.max(d.wMeters, 1e-6);
  const dh = Math.abs(x.face[1] - d.hMeters) / Math.max(d.hMeters, 1e-6);
  if (dw > 0.02 || dh > 0.02) bad.push({ x, dw, dh });
}
const byPpm = {};
for (const x of declared) (byPpm[x.dec.ppm] ??= []).push(x);
console.log(`DECLARED masonry: ${declared.length} faces carry a masonry() stamp`);
console.log(`  by declared ppm: ${Object.entries(byPpm).map(([k, v]) => `${k}:${v.length}`).join('  ')}`);
if (!bad.length) {
  console.log('  every one is mapped to the face it was painted for (within 2 %)');
} else {
  console.log(`  ${bad.length} PAINTED FOR ONE SIZE AND MAPPED TO ANOTHER:`);
  for (const { x, dw, dh } of bad.slice(0, 10))
    console.log(`   declared ${x.dec.wMeters}x${x.dec.hMeters} m at ${x.dec.ppm} px/m, mapped to ${x.face.join('x')} m` +
                ` (${(dw * 100).toFixed(0)}% / ${(dh * 100).toFixed(0)}% off) at (${x.c.join(', ')})`);
}
// Anything wall-shaped that carries NO stamp is not a fault — most of the world
// is not masonry — but it is the list to look at when a face seems to be missing
// from the answer above, and it is now clearly separated from the answer.
const undeclared = r.filter(x => !x.dec && x.face[1] > 3 && x.c[0] < 100 && x.img[0] > 20);
console.log(`\nwall-shaped but undeclared: ${undeclared.length} (not a fault — the shape net, kept for reference)`);

// walls only: tall exterior faces on the street, x within the block
const walls = r.filter(x => x.face[1] > 3 && x.c[0] < 100 && x.img[0] > 20);
const key = x => `${x.ppmX} x ${x.ppmY}`;
const groups = {};
for (const w of walls) (groups[key(w)] ??= []).push(w);
console.log(`\ntextured faces: ${r.length}   wall-sized exterior faces: ${walls.length}`);
console.log('px/m groups, MEASURED off the geometry (the old shape-based view):');
for (const [k, v] of Object.entries(groups).sort((a,b)=>b[1].length-a[1].length))
  console.log(`  ${String(v.length).padStart(3)} x   ${k}    e.g. face ${v[0].face.join('x')} m, canvas ${v[0].img.join('x')} at (${v[0].c.join(', ')})`);
await b.close();
if (SELFTEST) {
  if (bad.length) { console.log(`\nSELFTEST PASSED — the corrupted stamp was caught (${bad.length})`); process.exit(0); }
  console.error('\nSELFTEST FAILED — a stamp was made to disagree with its face and this did not notice.');
  process.exit(2);
}
process.exitCode = bad.length ? 1 : 0;
