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
//
// ⚠ THIS SCRIPT PRODUCED A RETRACTED FINDING. Its first version measured every
// BoxGeometry face against `parameters.width`. A box has four side faces: the
// ±x pair are `depth` across and the ±z pair are `width`. Using width for all
// of them reported 42 of 109 masonry faces as wrong when none were, and the
// claim reached three commits before mainline diagnosed it (7fe644b9).
//
// Fixed below by indexing the face from the material index, the same way
// scripts/seampairs.mjs does. When scripts/lib/faces.mjs lands (proposed in
// 1a9e4661, because four copies of this logic existed and two were wrong) this
// should use it instead of carrying a fifth.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { FACE_LIB } from './lib/faces.mjs';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.addInitScript({ content: FACE_LIB });   // window.__faceLib, see scripts/lib/faces.mjs
await p.goto(aim('http://localhost:4184/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, aim('http://localhost:4184/'));   // GOTCHAS 26: prove it, do not just name it
await p.waitForTimeout(1200);
// --selftest: the new "wrong density" verdict below must be able to go red, or
// it is decoration. Same mutation seampairs.mjs uses and for the same reason —
// double one masonry face's repeat.x, so it DRAWS at twice what its canvas
// achieved while the stamp is untouched. Nothing on disk, no source change.
const SELFTEST = process.argv.includes('--selftest');
if (SELFTEST) {
  const hit = await p.evaluate(() => {
    let n = 0;
    window.__ct.scene().traverse((o) => {
      if (n || !o.isMesh) return;
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
        if (n || !m?.map?.userData?.masonry) continue;
        m.map.repeat.x = (m.map.repeat.x || 1) * 2;
        n++;
      }
    });
    return n;
  });
  console.log(`selftest: doubled repeat.x on ${hit} masonry face — this MUST now go red`);
}
const out = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const rows = []; let stamped = 0, meshes = 0, mapped = 0;
  s.traverse(o => {
    if (!o.isMesh || !o.geometry) return; meshes++;
    // ⚠ THE `visible === false` SKIP THAT USED TO BE HERE MADE THIS CHECK
    // MEASURE NOTHING AND REPORT GREEN. Removed 2026-08-02 (w62, item 107).
    //
    // This file was registered in checks.mjs on the strength of "305 masonry
    // stamps, 16 disagreements, all 16 explained by whole-texel rounding".
    // Then 5016d26b5 ("Item 141: region cull — the street is not drawn while
    // you are indoors") added a culler that switches off every top-level group
    // west of REGION_X=100 plus every interior nobody has entered. At the
    // default spawn that is ALL 305 STAMPS IN THE WORLD, and this printed
    //
    //     7792 meshes · 1902 textured · 0 carry a masonry stamp
    //     FACES ACTUALLY AUTHORED AT THE WRONG DENSITY: 0        exit 0
    //
    // — a perfectly green guard with nothing behind it, for as long as nobody
    // read the middle line. `--selftest` had been failing (exit 2) the whole
    // time and checks.mjs does not pass it.
    //
    // The premise was simply wrong: DENSITY IS AN AUTHORING FACT AND
    // VISIBILITY IS A RENDERING ONE. A wall is painted at whatever density it
    // was painted at whether or not the culler has it switched on this frame,
    // and an interior is hidden exactly until the moment the player is stood
    // in it looking at the thing. Filtering on `visible` guaranteed this check
    // could never see the one place its own subject matter lives.
    //
    // It is also why the user's complaint was about a JAIL INTERIOR. Nothing
    // was ever going to catch that from out here.
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
    // one implementation, scripts/lib/faces.mjs — it was wrong in two scripts
    const { fw, fh } = window.__faceLib.dims(o, mi);
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
      // WHAT THE CANVAS ACTUALLY ACHIEVED, which is not always what was asked
      // for — see the verdict below. Published by tex-world.ts's masonry()
      // precisely so a checker does not have to re-derive it.
      achievedPpm: (ms.ppmW != null && ms.ppmH != null) ? [ms.ppmW, ms.ppmH] : null,
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

// ── THE VERDICT: compare against the ACHIEVED density, not the asked-for one ──
//
// The count above is NOT a defect count, and reading it as one is how this
// row reached the queue as "39 declared-vs-mapped density mismatches".
//
// The desk RULED on 2026-07-25 (665629c5a): density is the invariant and the
// canvas absorbs the remainder — `W = round(wMeters * ppm)`. A face that is
// not a whole number of texels therefore CANNOT draw at exactly its declared
// ppm, and no change to the world can make it. A 0.6 m band at 16 px/m wants
// 9.6 px and gets 10, which measures 16.67.
//
// That same commit predicted this row, in as many words: *"one unluckier face
// and that check goes red on a surface behaving exactly as the desk just ruled
// it should. The tolerance would then get widened, which is how a check stops
// being able to catch the thing it exists for."* So the answer is NOT a bigger
// tolerance — a fixed px/m tolerance is the wrong SHAPE, because the error
// from a half-texel scales as 0.5/faceMetres and is unbounded as the face gets
// thin. The answer is the one that commit already shipped:
//
//     userData.masonry.ppmW / .ppmH — what the whole-texel canvas ACHIEVED
//
// *"A checker wanting to catch a face authored at the WRONG density compares
// against ppmW/ppmH and keeps the declared value for 'what was intended'."*
// This script was the one checker that never did. It does now.
const withAch = checked.filter(r => r.achievedPpm);
const wrong = withAch.filter(r =>
  Math.abs(r.measured[0]-r.achievedPpm[0]) > 0.6 || Math.abs(r.measured[1]-r.achievedPpm[1]) > 0.6);
console.log(`\nof those, explained by whole-texel canvas rounding (the desk's ruling): ${disagree.length - wrong.length}`);
console.log(`FACES ACTUALLY AUTHORED AT THE WRONG DENSITY: ${wrong.length}`);
for (const r of wrong.slice(0,8))
  console.log(`   achieved ${r.achievedPpm.map(n=>+n.toFixed(2)).join('×')}, measured ${r.measured.join('×')}` +
              `  face ${r.faceM?.join('×')} m vs painted-for ${r.declaredM.join('×')} m  repeat ${r.repeat.join('×')}  at (${r.at.join(', ')})`);
if (checked.length !== withAch.length)
  console.log(`   (${checked.length - withAch.length} stamps carry no ppmW/ppmH and were not judged)`);
const naiveBad = checked.filter(r => Math.abs(r.naive[0]-r.declaredPpm) > 0.6 || Math.abs(r.naive[1]-r.declaredPpm) > 0.6);
console.log(`\nfor comparison, IGNORING map.repeat the disagreement count would be: ${naiveBad.length}`);
writeFileSync('shots/masonry.json', JSON.stringify(out,null,2));
await b.close();
// AN EXIT CODE, so this can guard rather than only narrate. `wrong` is the
// only number here that is a defect count; everything above it is description.
if (SELFTEST) {
  if (!wrong.length) {
    console.error('\nSELFTEST FAILED — a masonry face was made to draw at twice what its canvas achieved and this script did not notice. The verdict below is decoration.');
    process.exit(2);
  }
  console.log('\nselftest: caught it');
  process.exit(0);
}
process.exit(wrong.length ? 1 : 0);
