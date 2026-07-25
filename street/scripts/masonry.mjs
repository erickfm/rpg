// PATTERN #1, finally answerable. tex-world.ts now stamps every masonry texture
// with what it is and at what density (ddd36f8a):
//
//     t.userData.masonry = { ppm, mult, wMeters, hMeters, baseY, W, H }
//
// That fixes what broke density.mjs: its filter was geometric, so foliage,
// ground decals and signage sat in a net meant for walls.
//
// But an auditor who only reads the declaration has stopped auditing. A stamp
// that disagrees with the geometry it is on is WORSE than no stamp, because it
// looks like an answer. So this checks two things:
//
//   1. is every DECLARED density on the world's grid (8 or 16 px/m)?
//   2. does the declaration agree with the face it is actually mapped to?
//
// Face size comes from local geometry parameters times world scale, never from
// a bounding box -- a rotated group swaps x and z and mis-measures the face.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(1200);
const out = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const rows = []; let stamped = 0, meshes = 0, mapped = 0;
  s.traverse(o => {
    if (!o.isMesh || !o.geometry) return; meshes++;
    for (let q=o;q;q=q.parent) if (q.visible===false) return;
    // EVERY material, with its index — and the index is the whole story on a
    // box. This read `o.material[0]` and then measured `parameters.width`, but
    // material 0 is the +x face, whose dimensions are DEPTH x height. Height is
    // height on both side faces, which is exactly why the disagreement it found
    // was "vertical always right, horizontal always wrong" on all 42.
    //
    // Measured, all 42: declared width == the box's DEPTH, 42 of 42; declared
    // width == the box's WIDTH, 0 of 42. e.g. painted for 19.2 m on a box
    // 15.9 wide and 19.2 deep. The faces are correct and the reader was not.
    // scripts/density.mjs already indexes faces this way and says why.
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m, mi) => {
    if (!m || !m.map) return; mapped++;
    const ms = m.map.userData && m.map.userData.masonry;
    if (!ms) return; stamped++;
    // face size from LOCAL parameters x world scale
    const e = o.matrixWorld.elements;
    const len = (a,b2,c)=>Math.hypot(e[a],e[b2],e[c]);
    const S = [len(0,1,2), len(4,5,6), len(8,9,10)];
    const pr = o.geometry.parameters || {};
    let fw = null, fh = null;
    if (o.geometry.type === 'PlaneGeometry') { fw = (pr.width??0)*S[0]; fh = (pr.height??0)*S[1]; }
    else if (o.geometry.type === 'BoxGeometry') {
      // BoxGeometry material order is [+x, -x, +y, -y, +z, -z]
      if (mi === 0 || mi === 1)      { fw = (pr.depth??0)*S[2];  fh = (pr.height??0)*S[1]; }
      else if (mi === 4 || mi === 5) { fw = (pr.width??0)*S[0];  fh = (pr.height??0)*S[1]; }
      else                           { fw = (pr.width??0)*S[0];  fh = (pr.depth??0)*S[2];  }
    }
    const img = m.map.image;
    // map.repeat is the trap: a canvas painted for one width and TILED onto a
    // wider face has the right density and the wrong naive arithmetic. I made
    // exactly this error on floor density earlier in this audit.
    const rep = [m.map.repeat.x, m.map.repeat.y];
    const measured = (fw>0.05 && fh>0.05 && img)
      ? [ +((img.width*Math.abs(rep[0]))/fw).toFixed(2), +((img.height*Math.abs(rep[1]))/fh).toFixed(2) ] : null;
    const naive = (fw>0.05 && fh>0.05 && img) ? [ +(img.width/fw).toFixed(2), +(img.height/fh).toFixed(2) ] : null;
    const g=o.geometry; if(!g.boundingBox)g.computeBoundingBox();
    const bb=g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    rows.push({ declaredPpm: ms.ppm, mult: ms.mult,
      declaredM: [ms.wMeters, ms.hMeters], canvas: img?[img.width,img.height]:null,
      faceM: fw?[+fw.toFixed(2), +fh.toFixed(2)]:null, measured, naive,
      repeat: [+rep[0].toFixed(3), +rep[1].toFixed(3)],
      at: [+((bb.min.x+bb.max.x)/2).toFixed(1), +((bb.min.y+bb.max.y)/2).toFixed(1), +((bb.min.z+bb.max.z)/2).toFixed(1)],
      type: o.geometry.type, mi });
    });
  });
  return { meshes, mapped, stamped, rows };
});
console.log(`${out.meshes} meshes · ${out.mapped} textured · ${out.stamped} carry a masonry stamp\n`);
const byPpm = {};
for (const r of out.rows) byPpm[`${r.declaredPpm} (mult ${r.mult})`] = (byPpm[`${r.declaredPpm} (mult ${r.mult})`]||0)+1;
console.log('DECLARED densities:');
for (const [k,v] of Object.entries(byPpm).sort((a,c)=>c[1]-a[1])) console.log(`   ${String(v).padStart(4)} ×  ${k} px/m`);
const onGrid = d => Math.abs(d-8)<0.01 || Math.abs(d-16)<0.01;
const offDecl = out.rows.filter(r => !onGrid(r.declaredPpm));
console.log(`\ndeclared OFF the 8/16 grid: ${offDecl.length}`);
for (const r of offDecl.slice(0,6)) console.log(`   ${r.declaredPpm} px/m at (${r.at.join(', ')})`);
// does the declaration match the geometry it is on?
const checked = out.rows.filter(r => r.measured);
const disagree = checked.filter(r => Math.abs(r.measured[0]-r.declaredPpm) > 0.6 || Math.abs(r.measured[1]-r.declaredPpm) > 0.6);
console.log(`\nstamps checkable against geometry: ${checked.length}`);
console.log(`stamps that DISAGREE with their face by >0.6 px/m: ${disagree.length}`);
for (const r of disagree.slice(0,8))
  console.log(`   declared ${r.declaredPpm}, measured ${r.measured.join('×')} (naive ${r.naive.join('×')}, repeat ${r.repeat.join('×')})  face ${r.faceM?.join('×')} m  at (${r.at.join(', ')})`);
const naiveBad = checked.filter(r => Math.abs(r.naive[0]-r.declaredPpm) > 0.6 || Math.abs(r.naive[1]-r.declaredPpm) > 0.6);
console.log(`\nfor comparison, IGNORING map.repeat the disagreement count would be: ${naiveBad.length}`);
writeFileSync('shots/masonry.json', JSON.stringify(out,null,2));
await b.close();
