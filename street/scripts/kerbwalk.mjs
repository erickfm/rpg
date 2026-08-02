// THE KERB IS DISCONTINUOUS AND THE PAVEMENT IS "ONLY 3 SLABS".
//
// Two faults in one sentence (shots/user-kerb-discontinuous.png) and they want
// different answers, so this measures both BEFORE anything is painted.
//
//   A. the pavement flags — what density does the walk sheet actually land at,
//      in x and in z, on every walk surface? A joint pattern that reads as
//      three long ribbons is a sheet stretched along the direction of travel.
//   B. the kerb ribbon — is it CONTINUOUS? Three explanations want three
//      different fixes: gaps in the geometry, a texture that does not tile
//      along its length, or runs that do not meet. So walk the triangle strip
//      vertex by vertex and report the largest gap between consecutive spans.
//
// It prints. It does not assert — an investigation, not a guard.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { goto } from './lib/reachable.mjs';

const URL = aim('http://localhost:4279/');
const b = await chromium.launch();
const p = await b.newPage();
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

const out = await p.evaluate(() => {
  const scene = window.__ct.scene();
  scene.updateMatrixWorld(true);
  const walks = [], ribbons = [], ribbonsSkipped = [];

  scene.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    const g = n.geometry;
    g.computeBoundingBox();
    const bb = g.boundingBox.clone().applyMatrix4(n.matrixWorld);
    const w = bb.max.x - bb.min.x, d = bb.max.z - bb.min.z, h = bb.max.y - bb.min.y;
    if (bb.min.y > 0.9 || bb.max.y < -0.3) return;      // ground only
    if (Math.abs(bb.min.x) > 200 || Math.abs(bb.min.z) > 200) return;
    const mats = Array.isArray(n.material) ? n.material : [n.material];

    // ── A: any horizontal sheet big enough to be pavement ──────────────────
    if (w > 0.5 && d > 0.5 && h < 0.6) {
      // IS THIS A SHEET AT ALL, OR A RIBBON WRAPPING THE BLOCK?
      //
      // This is the guard the first version of this script did not have, and
      // its absence is the whole of notes/B-kerb-and-flags-one-root.md being
      // wrong. The kerb face, the arris, the gutter pan and the red paint are
      // four strips ~0.15 m tall that run right round the roadway — so each
      // one's BOUNDING BOX is 60 x 124 m while the strip itself is about 37 m2.
      // Dividing a texture size by that box gives "0.03 texels per metre",
      // which I reported to the desk as a measurement of the pavement. It is
      // not a measurement of anything.
      //
      // A sheet fills its own footprint; a ribbon fills a fraction of a per
      // cent of it. So sum the triangles and compare.
      // The area is the TRIANGLES' OWN 3D area, not their footprint on the
      // ground. My first attempt projected onto xz, and a kerb face is
      // VERTICAL — it projects to nothing, fell into the "area is zero, assume
      // it is a sheet" branch, and came straight back into the table it was
      // supposed to be kept out of. It also has to follow the index buffer:
      // reading a PlaneGeometry as raw triples reported the alley floor at
      // 0 m2 and threw away a real surface.
      const pos = g.attributes.position, idx = g.index;
      const nTri = idx ? idx.count / 3 : pos ? pos.count / 3 : 0;
      const vi = (t, k) => (idx ? idx.getX(t * 3 + k) : t * 3 + k);
      let area = 0;
      for (let t = 0; t < nTri; t++) {
        const a = vi(t, 0), b2 = vi(t, 1), c2 = vi(t, 2);
        const ux = pos.getX(b2) - pos.getX(a), uy = pos.getY(b2) - pos.getY(a), uz = pos.getZ(b2) - pos.getZ(a);
        const vx = pos.getX(c2) - pos.getX(a), vy = pos.getY(c2) - pos.getY(a), vz = pos.getZ(c2) - pos.getZ(a);
        area += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
      }
      const fill = nTri ? area / (w * d) : 1;
      if (fill < 0.05) {
        ribbonsSkipped.push({ w: +w.toFixed(1), d: +d.toFixed(1), fill: +fill.toFixed(4),
                              area: +area.toFixed(1),
                              tex: mats[0]?.map?.image
                                ? `${mats[0].map.image.width}x${mats[0].map.image.height}` : 'none' });
        return;
      }
      for (const m of mats) {
        if (!m || !m.map || !m.map.image) continue;
        const iw = m.map.image.width, ih = m.map.image.height;
        const rx = m.map.repeat.x || 1, ry = m.map.repeat.y || 1;
        // texels per metre = canvas px covering the region / metres of region.
        // With repeat r, the region shows iw/r... no: repeat r means the region
        // spans r tiles, so it shows r*iw texels across w metres.
        const tx = (iw * rx) / w, tz = (ih * ry) / d;
        walks.push({
          w: +w.toFixed(2), d: +d.toFixed(2),
          at: [+((bb.min.x + bb.max.x) / 2).toFixed(1), +bb.max.y.toFixed(3),
               +((bb.min.z + bb.max.z) / 2).toFixed(1)],
          tex: iw + 'x' + ih, rep: [+rx.toFixed(3), +ry.toFixed(3)],
          tx: +tx.toFixed(2), tz: +tz.toFixed(2),
          type: g.type, mod: n.userData.mod ?? '',
        });
        break;
      }
    }

    // ── B: the kerb ribbon — a raw BufferGeometry standing on its edge ─────
    if (g.type === 'BufferGeometry' && h > 0.05 && h < 0.6 && !g.index) {
      const pos = g.attributes.position;
      if (!pos || pos.count < 60) return;
      // collect the TOP edge of the ribbon: vertices at the highest y band
      let top = -Infinity;
      for (let i = 0; i < pos.count; i++) top = Math.max(top, pos.getY(i));
      const pts = [];
      for (let i = 0; i < pos.count; i++) {
        if (pos.getY(i) > top - 0.02) pts.push([+pos.getX(i).toFixed(3), +pos.getZ(i).toFixed(3)]);
      }
      if (pts.length < 20) return;
      ribbons.push({ n: pos.count, topN: pts.length, top: +top.toFixed(3),
                     pts, mapW: mats[0]?.map?.image?.width ?? 0,
                     bb: [+bb.min.x.toFixed(1), +bb.max.x.toFixed(1),
                          +bb.min.z.toFixed(1), +bb.max.z.toFixed(1)] });
    }
  });
  return { walks, ribbons, ribbonsSkipped };
});

console.log('\n── A. every horizontal textured sheet on the ground ──');
console.log('  (texels/m in x and in z; the world mandate is 32)');
const bad = [];
for (const r of out.walks.sort((a, b) => b.w * b.d - a.w * a.d)) {
  const flag = (r.tx < 8 || r.tz < 8) ? '  <-- STRETCHED' : '';
  if (flag) bad.push(r);
  console.log(`  ${String(r.w).padStart(7)} x ${String(r.d).padStart(7)} m  at ${JSON.stringify(r.at).padEnd(22)}` +
    ` ${r.tex.padStart(9)} rep ${JSON.stringify(r.rep).padEnd(16)} -> ${String(r.tx).padStart(7)} / ${String(r.tz).padStart(7)} tex/m${flag}`);
}
console.log(`\n  ${out.walks.length} sheets, ${bad.length} below 8 texels/m on an axis`);
console.log(`\n── NOT sheets, and no density is reported for them ──`);
console.log('  A ribbon that wraps the block has a 60 x 124 m bounding box and a few');
console.log('  dozen square metres of surface. Dividing a texture size by that box is');
console.log('  what produced my "0.03 texels/m along z", which measured nothing.');
for (const r of out.ribbonsSkipped) {
  console.log(`  ${String(r.w).padStart(6)} x ${String(r.d).padStart(6)} m bbox, ` +
    `${String(r.area).padStart(7)} m2 of actual surface (${(r.fill * 100).toFixed(2)}% fill), map ${r.tex}`);
}

console.log('\n── B. the kerb ribbons: is the run continuous? ──');
for (const r of out.ribbons) {
  // order the top-edge points along the run and report the biggest step
  const u = r.pts.slice().sort((a, b) => (a[1] - b[1]) || (a[0] - b[0]));
  // walk them as a chain by nearest-unused neighbour from one end
  const used = new Array(u.length).fill(false);
  let cur = 0; used[0] = true;
  let worst = 0, worstAt = null, chain = 1;
  const seen = new Set([u[0].join(',')]);
  for (;;) {
    let best = -1, bd = Infinity;
    for (let i = 0; i < u.length; i++) {
      if (used[i]) continue;
      const dd = Math.hypot(u[i][0] - u[cur][0], u[i][1] - u[cur][1]);
      if (dd < bd) { bd = dd; best = i; }
    }
    if (best < 0) break;
    if (bd > worst) { worst = bd; worstAt = [u[cur], u[best]]; }
    used[best] = true; cur = best; chain++;
    seen.add(u[best].join(','));
  }
  console.log(`  ribbon x[${r.bb[0]}..${r.bb[1]}] z[${r.bb[2]}..${r.bb[3]}]  ${r.n} verts,` +
    ` ${r.topN} on the top edge (${seen.size} distinct), map ${r.mapW}px`);
  console.log(`    largest gap between consecutive top-edge points: ${worst.toFixed(3)} m` +
    (worstAt ? `  at ${JSON.stringify(worstAt[0])} -> ${JSON.stringify(worstAt[1])}` : ''));
}

await b.close();
