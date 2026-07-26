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
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { goto } from './lib/reachable.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4279/';
const b = await chromium.launch();
const p = await b.newPage();
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

const out = await p.evaluate(() => {
  const scene = window.__ct.scene();
  scene.updateMatrixWorld(true);
  const walks = [], ribbons = [];

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
  return { walks, ribbons };
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
