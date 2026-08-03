// ONE-SHOT: what does the density landscape of the whole world actually look
// like? Item 107 asks for a sweep over EVERY textured face, not just the
// masonry-stamped subset. Before choosing any tolerance I want the histogram,
// because the item's own warning is "expect a large first number and do not
// tune it down" — and the only way to not tune is to know what the honest
// distribution is first.
//
// Measures nothing it can avoid: face size from FACE_LIB (the four-copies bug),
// drawn density from image size x repeat / face metres.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { FACE_LIB } from '../lib/faces.mjs';
import { writeFileSync } from 'node:fs';

const URL = process.env.SHOT_URL || 'http://localhost:4183/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.addInitScript({ content: FACE_LIB });
await p.goto(aim(URL), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(1500);

const out = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const rows = [];
  let meshes = 0, mapped = 0, stamped = 0, kinded = 0, unmeasurable = 0;
  s.traverse((o) => {
    if (!o.isMesh || !o.geometry) return; meshes++;
    for (let q = o; q; q = q.parent) if (q.visible === false) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m, mi) => {
      if (!m || !m.map) return; mapped++;
      const u = m.map.userData || {};
      const ms = u.masonry || null;
      const kind = u.surface || null;
      if (ms) stamped++;
      if (kind) kinded++;
      const { fw, fh } = window.__faceLib.dims(o, mi);
      const img = m.map.image;
      if (!(fw > 0.02 && fh > 0.02 && img && img.width)) { unmeasurable++; return; }
      const rx = Math.abs(m.map.repeat.x) || 1, ry = Math.abs(m.map.repeat.y) || 1;
      const ppmX = (img.width * rx) / fw;
      const ppmY = (img.height * ry) / fh;
      const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
      const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
      rows.push({
        name: o.name || '', mod: (o.userData && o.userData.mod) || '',
        kind, hasStamp: !!ms,
        declPpm: ms ? ms.ppm : null,
        achPpm: ms && ms.ppmW != null ? [ms.ppmW, ms.ppmH] : null,
        ppm: [+ppmX.toFixed(2), +ppmY.toFixed(2)],
        face: [+fw.toFixed(3), +fh.toFixed(3)],
        canvas: [img.width, img.height],
        repeat: [+rx.toFixed(3), +ry.toFixed(3)],
        type: g.type, mi,
        at: [+((bb.min.x + bb.max.x) / 2).toFixed(1), +((bb.min.y + bb.max.y) / 2).toFixed(1),
             +((bb.min.z + bb.max.z) / 2).toFixed(1)],
      });
    });
  });
  return { meshes, mapped, stamped, kinded, unmeasurable, rows };
});

console.log(`${out.meshes} meshes · ${out.mapped} textured faces · ${out.stamped} masonry-stamped · ` +
            `${out.kinded} kind-declared · ${out.unmeasurable} unmeasurable\n`);

// --- how square are the texels? the invariant that needs NO declaration ---
const ratio = (r) => { const a = r.ppm[0], b2 = r.ppm[1]; return a > b2 ? a / b2 : b2 / a; };
const buckets = { '1.00-1.05': 0, '1.05-1.25': 0, '1.25-1.5': 0, '1.5-2': 0, '2-4': 0, '4-10': 0, '10+': 0 };
for (const r of out.rows) {
  const v = ratio(r);
  if (v < 1.05) buckets['1.00-1.05']++;
  else if (v < 1.25) buckets['1.05-1.25']++;
  else if (v < 1.5) buckets['1.25-1.5']++;
  else if (v < 2) buckets['1.5-2']++;
  else if (v < 4) buckets['2-4']++;
  else if (v < 10) buckets['4-10']++;
  else buckets['10+']++;
}
console.log('TEXEL ASPECT (ppmX:ppmY on the same face, 1.0 = square):');
for (const [k, v] of Object.entries(buckets)) console.log(`   ${String(v).padStart(5)} ×  ${k}`);

// --- absolute density landscape ---
const dens = {};
for (const r of out.rows) {
  const d = Math.max(r.ppm[0], r.ppm[1]);
  const k = d < 4 ? '<4' : d < 8 ? '4-8' : d < 12 ? '8-12' : d < 20 ? '12-20' : d < 36 ? '20-36'
          : d < 64 ? '36-64' : d < 128 ? '64-128' : d < 256 ? '128-256' : '256+';
  dens[k] = (dens[k] || 0) + 1;
}
console.log('\nDRAWN DENSITY (the coarser axis of each face):');
for (const k of ['<4', '4-8', '8-12', '12-20', '20-36', '36-64', '64-128', '128-256', '256+'])
  if (dens[k]) console.log(`   ${String(dens[k]).padStart(5)} ×  ${k} px/m`);

console.log('\nWORST 25 BY TEXEL ASPECT:');
for (const r of [...out.rows].sort((a, c) => ratio(c) - ratio(a)).slice(0, 25))
  console.log(`   ${ratio(r).toFixed(1).padStart(7)}x  ${r.ppm.join(' × ')} px/m  face ${r.face.join('×')} m  ` +
              `canvas ${r.canvas.join('×')}  rep ${r.repeat.join('×')}  ${r.type}/${r.mi}  ` +
              `${r.kind || 'UNDECLARED'}  ${r.mod || r.name || '?'}  at (${r.at.join(', ')})`);

console.log('\nWORST 20 BY ABSOLUTE DENSITY:');
for (const r of [...out.rows].sort((a, c) => Math.max(...c.ppm) - Math.max(...a.ppm)).slice(0, 20))
  console.log(`   ${Math.max(...r.ppm).toFixed(0).padStart(6)} px/m  ${r.ppm.join(' × ')}  face ${r.face.join('×')} m  ` +
              `canvas ${r.canvas.join('×')}  ${r.kind || 'UNDECLARED'}  ${r.mod || r.name || '?'}  at (${r.at.join(', ')})`);

writeFileSync('shots/w62-density-explore.json', JSON.stringify(out, null, 2));
console.log(`\nwrote shots/w62-density-explore.json (${out.rows.length} rows)`);
await b.close();
