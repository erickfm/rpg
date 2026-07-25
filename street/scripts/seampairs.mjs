// THE QUESTION A SEAM AUDIT WAS ALWAYS ABOUT: does this face agree with the
// face it TOUCHES?
//
// Every density pass I have run, including my own, asked "is this face on the
// 8/16 grid". That is a proxy for agreement and it is not the same thing:
//
//   · a face at 4.09 next to one at 9.69 is a 2.4x mismatch, and my grid check
//     flagged neither of them until the masonry stamp existed
//   · a face at 8 next to one at 16 is a 2x mismatch and BOTH PASS the grid
//     check, because both are legal densities
//
// So this compares neighbours instead. Masonry faces that share space are
// paired, and the pair is judged on whether its two densities match — which is
// what a player sees at the corner where they meet.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { FACE_LIB } from './lib/faces.mjs';
// --selftest: make one masonry face draw at the wrong scale and require this to
// go red. Written because I listed seampairs in notes/A-selftests.md as the one
// tool of mine that COULD NOT FAIL, and then left it that way for a week while
// fixing three reporting bugs in it.
const SELFTEST = process.argv.includes('--selftest');
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.addInitScript({ content: FACE_LIB });   // window.__faceLib, see scripts/lib/faces.mjs
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, process.env.SHOT_URL ?? 'http://localhost:4184/');   // GOTCHAS 26: prove it, do not just name it
await p.waitForTimeout(1200);
if (SELFTEST) {
  // Double one stamped texture's repeat.x. Measured density is
  // (canvas width * repeat) / face width, and the stamp is untouched — so this
  // face still DECLARES 8 px/m while DRAWING 16, which is exactly the defect
  // this tool exists to find: two faces meant to be one run of brick, drawing
  // bricks of different sizes. No source changes, nothing on disk.
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
  const faces = [];
  s.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    for (let q=o;q;q=q.parent) if (q.visible===false) return;
    // EVERY material, indexed. This read material[0] and then measured
    // parameters.width — but on a BoxGeometry material 0 is the +x face, which
    // is DEPTH x height. That misread produced Round 10's 42 "disagreements"
    // (3f3c3ddb: declared width == box depth on 42 of 42, == box width on 0 of
    // 42) and the same numbers reappear here: 4.09 px/m is a 12 m canvas
    // measured against a 23.5 m width, which is Round 10's row 3 verbatim.
    const mats = Array.isArray(o.material)?o.material:[o.material];
    mats.forEach((m, mi) => {
    if (!m || !m.map) return;
    // Unstamped faces are collected too, marked. The live half of the brick
    // question (f604c531) is "something masonry() did not paint" — a hand-
    // painted brick-like face standing next to declared masonry. Collecting
    // only stamps made that case invisible here by construction.
    const ms = (m.map.userData && m.map.userData.masonry) || null;
    // What the painter says this surface IS (declareSurface in ct/paint.ts).
    // Null means nobody has said, which is UNJUDGEABLE rather than suspect —
    // and counted as such at the bottom, so the gap stays visible.
    const kind = (m.map.userData && m.map.userData.surface) || null;
    const e=o.matrixWorld.elements, len=(a,b2,c)=>Math.hypot(e[a],e[b2],e[c]);
    const S=[len(0,1,2),len(4,5,6),len(8,9,10)], pr=o.geometry.parameters||{};
    const { fw, fh } = window.__faceLib.dims(o, mi);   // scripts/lib/faces.mjs
    if (!(fw>0.05&&fh>0.05)) return;
    const img=m.map.image; if(!img) return;
    const g=o.geometry; if(!g.boundingBox)g.computeBoundingBox();
    const bb=g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    // Only wall-sized unstamped faces, and NOT cut-outs.
    //
    // 1466eb13 put eyes on this tool's first candidate list and found all four
    // ~6 px/m faces were IVY on party walls. Correct triage, and it cost someone
    // a pass. The fix is not to name ivy — a list of things to ignore is the
    // stale-constant habit — but to ask something that is actually diagnostic:
    // MASONRY IS NEVER A CUT-OUT. A face with alphaTest is foliage, a fence, a
    // sticker or a sign; you can see through it, so it is not the brick wall the
    // seam question is about. Ivy is exactly that (alphaTest 0.5, DoubleSide).
    if (!ms && (fw < 2 || fh < 2 || m.alphaTest > 0)) return;
    // THE FACE'S OWN RECTANGLE IN WORLD SPACE, not the mesh's bounding box.
    //
    // 7d4c345b: "a bounding box is not the shape". The adjacency test below used
    // the MESH bbox, and a shopfront band is a long thin mesh whose box spans an
    // entire frontage — so it paired with faces metres from any part of its real
    // geometry, and reported junctions that do not exist. Same error as reading
    // parameters.width for every face of a box, in a different place.
    //
    // So each face carries five world points: its centre and its four corners,
    // placed on the correct side of the box and spanning the correct two axes.
    const V = (x,y,z) => new (s.position.constructor)(x,y,z);
    const hw = fw/2, hh = fh/2;
    const { ctr, ax, ay } = window.__faceLib.frame(o, mi);   // scripts/lib/faces.mjs
    // A 5x3 grid, not just the corners. Two long walls meeting along the MIDDLE
    // of an edge share no corner, so a corner-only test misses exactly the
    // junction this tool exists to find.
    // The face's world NORMAL, for the back-to-back test below.
    const nrm = (() => {
      const n0 = [ax[1]*ay[2]-ax[2]*ay[1], ax[2]*ay[0]-ax[0]*ay[2], ax[0]*ay[1]-ax[1]*ay[0]];
      const o0 = o.localToWorld(V(0,0,0)), o1 = o.localToWorld(V(n0[0],n0[1],n0[2]));
      const d = [o1.x-o0.x, o1.y-o0.y, o1.z-o0.z];
      const L = Math.hypot(d[0],d[1],d[2]) || 1;
      return [d[0]/L, d[1]/L, d[2]/L];
    })();
    const pts = [];
    const GU = [-1,-0.5,0,0.5,1], GV = [-1,0,1];
    for (const su of GU) for (const sv of GV) {
      const lx = ctr[0] + ax[0]*su*hw + ay[0]*sv*hh;
      const ly = ctr[1] + ax[1]*su*hw + ay[1]*sv*hh;
      const lz = ctr[2] + ax[2]*su*hw + ay[2]*sv*hh;
      const wv = o.localToWorld(V(lx,ly,lz));
      pts.push([wv.x, wv.y, wv.z]);
    }
    faces.push({ u:+((img.width*Math.abs(m.map.repeat.x))/fw).toFixed(2),
                 v:+((img.height*Math.abs(m.map.repeat.y))/fh).toFixed(2),
                 declared: ms ? ms.ppm : null, stamped: !!ms, d: ms ? ms.ppm : null, kind,
                 pts, nrm,
                 x0:bb.min.x,x1:bb.max.x,y0:bb.min.y,y1:bb.max.y,z0:bb.min.z,z1:bb.max.z,
                 at:[+((bb.min.x+bb.max.x)/2).toFixed(1),+((bb.min.y+bb.max.y)/2).toFixed(1),+((bb.min.z+bb.max.z)/2).toFixed(1)] });
    });
  });
  // neighbours: the two FACES' own rectangles within 0.6 m of each other.
  // Corner-and-centre samples, so a long band only pairs where it actually
  // reaches. The bbox version paired a band with anything inside its frontage-
  // wide box (7d4c345b).
  // one implementation, scripts/lib/faces.mjs — face rectangles measured to the
  // other face's rectangle as a box, which is pairclip's slab idea on my face
  // geometry rather than on a mesh bounding box.
  const near = (a,c) => window.__faceLib.touches(a, c, 0.35);
  const pairs = [];
  for (let i=0;i<faces.length;i++) for (let j=i+1;j<faces.length;j++) {
    if (!near(faces[i],faces[j])) continue;
    const a=faces[i], c=faces[j];
    const rU = Math.max(a.u,c.u)/Math.min(a.u,c.u);
    const rV = Math.max(a.v,c.v)/Math.min(a.v,c.v);
    pairs.push({ rU:+rU.toFixed(2), rV:+rV.toFixed(2), a:{u:a.u,v:a.v,d:a.declared,at:a.at,kind:a.kind}, c:{u:c.u,v:c.v,d:c.declared,at:c.at,kind:c.kind},
      mixed: a.stamped !== c.stamped,
      kinds: [a.kind, c.kind],
      bothOnGrid: [a.declared,c.declared].every(d=>d!==null&&(Math.abs(d-8)<0.01||Math.abs(d-16)<0.01)) });
  }
  return { nFaces: faces.length, nPairs: pairs.length, pairs };
});
console.log(`${out.nFaces} masonry faces · ${out.nPairs} touching pairs\n`);
const bad = out.pairs.filter(q => q.rU > 1.15 || q.rV > 1.15).sort((a,c)=>(c.rU*c.rV)-(a.rU*a.rV));
console.log(`pairs whose densities DISAGREE by more than 15%: ${bad.length} of ${out.nPairs}`);
const gridBlind = bad.filter(q => q.bothOnGrid);
console.log(`   of those, pairs where BOTH faces pass the 8/16 grid check: ${gridBlind.length}`);

// ── LIKE-FOR-LIKE IS THE HEADLINE, so compute it rather than leaving it prose ──
//
// A shopfront band declares 16 and the wall above it declares 8. They meet, and
// they are SUPPOSED to differ by exactly SHOP_MULT — that junction is the design,
// not a defect. Counting it as a disagreement makes the number say the opposite
// of what it means, and the number is what gets escalated.
//
// Only pairs that declare the SAME density are like-for-like: two faces meant to
// be one continuous run of brick. Those are the ones where a mismatch is a seam
// a player can see.
// ── THE LIVE HALF: declared masonry meeting something masonry() never painted ──
const mixed = out.pairs.filter(q => q.mixed && (q.rU > 1.15 || q.rV > 1.15));
// Split the candidates by whether the UNDECLARED face is itself on the 8/16
// grid. One reads as brick at the right size and is only a provenance question —
// painted outside masonry(), looks correct. The other is off-grid and is what a
// photograph of mismatched brick would actually be.
const onGridU = (f) => Math.abs(f.u - 8) < 0.5 || Math.abs(f.u - 16) < 0.5;
const und = (q) => (q.a.d !== null ? q.c : q.a);
// Three columns, not one list. A pair is only ANSWERABLE when both faces have
// said what they are; otherwise the tool is guessing, and guessing is what put
// ivy on a brick list.
const bothBrick = mixed.filter(q => q.kinds.every(k => k === 'brick'));
const notBrick  = mixed.filter(q => q.kinds.some(k => k && k !== 'brick'));
const unknown   = mixed.filter(q => q.kinds.some(k => !k) && !q.kinds.some(k => k && k !== 'brick'));
// Over the UNJUDGEABLE ones only. This counted every `mixed` pair, which was
// right when they were all candidates and became wrong the moment modules began
// declaring: a face declared 'detail' is legitimately off the 8/16 grid — a
// door handle is not brick and is not meant to be 8 px/m — so counting it as
// "what a photograph of mismatched brick could be" overstates by 100.
// Fourth time a summary line in this file has outlived the population it
// described. They do not go stale by being wrong; they go stale by the world
// answering the question underneath them.
const offGrid = unknown.filter((q) => !onGridU(und(q)));
console.log(`\nMASONRY touching a NON-MASONRY face, densities disagreeing: ${mixed.length}`);
console.log(`   brick vs brick, a real seam question:  ${bothBrick.length}`);
console.log(`   one side says it is not brick:         ${notBrick.length}`);
console.log(`   UNJUDGEABLE — nobody has said what the other face is: ${unknown.length}`);
console.log(`   one line at the texture fixes that: declareSurface(tex, 'brick'|'sign'|…) in ct/paint.ts`);
// NAME THE FACES, or "declare your textures" is guesswork.
//
// 8154f456 declared 53 textures and reported the count did not move. That is
// correct behaviour and a useless experience: the count only moves when the
// faces IN THESE PAIRS declare, and this printed a number without saying which
// ones they are. So an owner had to declare everything and hope.
//
// Distinct undeclared faces, largest first — the same scoping 21292ebb did by
// hand to turn 150 pairs into 49 faces into 3 groups, done by the tool.
// The endpoints carry `kind` now. They did not, so `f.kind` below was always
// undefined and EVERY face in an unknown pair was listed as needing a
// declaration — including ones that already had one. 62fdb232 caught it by
// querying the meshes at a coordinate this printed and finding the face there
// declares 'ground'. The bucket counts were right; this list was not, and it is
// the list people were meant to act on.
const needed = new Map();
for (const q of unknown) for (const f of [q.a, q.c]) {
  if (f.kind) continue;
  const k = f.at.join(',');
  if (!needed.has(k)) needed.set(k, { at: f.at, u: f.u, v: f.v, n: 0 });
  needed.get(k).n++;
}
if (needed.size) {
  const list = [...needed.values()].sort((a, b) => b.n - a.n);
  console.log(`\n   ${list.length} distinct faces are what is actually missing:`);
  for (const f of list.slice(0, 12))
    console.log(`      ${String(f.n).padStart(3)} pairs   ${f.u}x${f.v} px/m at (${f.at.join(',')})`);
  if (list.length > 12) console.log(`      …and ${list.length - 12} more`);
}
console.log(`   of the unjudgeable, the undeclared face is OFF the 8/16 grid: ${offGrid.length}` +
  ` — those could be a visible mismatch`);
console.log(`   the rest read 8 or 16: a provenance question, not a visual one`);
const seenM = new Set();
// Show the UNJUDGEABLE ones. Showing all `mixed` led with pairs that are already
// answered — a face declared 'detail' next to brick is not a question anyone
// needs to look at, and putting it at the top of the list buries the ones that
// are.
for (const q of (unknown.length ? unknown : mixed).sort((a,c)=>(c.rU)-(a.rU))) {
  const st = q.a.d !== null ? q.a : q.c, un = q.a.d !== null ? q.c : q.a;
  const k = `${un.at.join(',')}`; if (seenM.has(k)) continue; seenM.add(k);
  if (seenM.size > 8) break;
  // Say what the face IS, not merely that it has no masonry stamp. This printed
  // the word UNDECLARED for any face masonry() did not paint — including faces
  // that DO declare, as 'ground' or 'sign'. 62fdb232 read that as the tool
  // failing to see its declaration, which is exactly what the word says.
  const kindOf = (f) => f.kind ? `declared '${f.kind}'` : 'UNDECLARED';
  console.log(`   u ${String(q.rU).padStart(5)}×   ${kindOf(un)} ${un.u}×${un.v} px/m at (${un.at.join(',')})` +
              `   touching masonry ${st.d} px/m at (${st.at.join(',')})`);
}
const like = out.pairs.filter(q => q.a.d !== null && q.c.d !== null && Math.abs(q.a.d - q.c.d) < 0.01);
const likeBad = like.filter(q => q.rU > 1.15 || q.rV > 1.15);
// BOTH declared, and declaring differently — the band/wall case. Unstamped
// faces must not leak in here: they have no declared density to differ from,
// and letting them widen the ratio range makes this line claim something it
// cannot support. That is the mistake I have twice corrected in other tools.
const unlike = bad.filter(q => q.a.d !== null && q.c.d !== null && Math.abs(q.a.d - q.c.d) >= 0.01);
const ratios = unlike.map(q => Math.max(q.rU, q.rV));
console.log(`\nLIKE-FOR-LIKE (both faces declare the same density): ${like.length} pairs`);
console.log(`   disagreeing by more than 15%: ${likeBad.length}`);
for (const q of likeBad.slice(0, 8))
  console.log(`      ${q.a.u}×${q.a.v} at (${q.a.at.join(',')})  vs  ${q.c.u}×${q.c.v} at (${q.c.at.join(',')})`);
// Break these down rather than asserting one explanation over the whole range.
// The line used to say "SHOP_MULT is 2" across a range that now reaches 4.03x,
// and a 4x pair is not SHOP_MULT — it is the 32 px/m flagstone paving meeting a
// wall. Claiming more than the data supports is the failure this file has now
// made three times.
const near2 = unlike.filter(q => Math.max(q.rU,q.rV) < 2.2).length;
const other = unlike.length - near2;
console.log(`declared-DIFFERENT pairs among the disagreements: ${unlike.length}`);
console.log(`   ${near2} at ~2x — a shopfront band meeting the wall above it, which is SHOP_MULT and the design`);
if (other) console.log(`   ${other} at other ratios — includes the 32 px/m flagstone paving against 8 px/m wall (4x)`);
console.log('');
for (const q of (likeBad.length ? likeBad : bad).slice(0,10))
  console.log(`   u ${String(q.rU).padStart(5)}× v ${String(q.rV).padStart(5)}×   ${q.a.u}×${q.a.v} (decl ${q.a.d}) at (${q.a.at.join(',')})   vs   ${q.c.u}×${q.c.v} (decl ${q.c.d}) at (${q.c.at.join(',')})`);
writeFileSync('shots/seampairs.json', JSON.stringify(out,null,2));
await b.close();

// THE VERDICT. Two conditions are defects and everything else in this output is
// context: two faces meant to be one run of brick that draw different-sized
// brick (like-for-like), and a hand-painted face declaring 'brick' that
// disagrees with the masonry beside it. Unjudgeable pairs are a missing
// declaration, not a fault, and are reported without failing.
const real = likeBad.length + bothBrick.length;
if (SELFTEST) {
  if (real) { console.log(`\nSELFTEST PASSED — the mis-scaled face was caught (${real})`); process.exit(0); }
  console.error('\nSELFTEST FAILED — a masonry face was made to draw at twice its declared');
  console.error('scale and this did not notice. Do not trust a green run until that is fixed.');
  process.exit(2);
}
if (real) {
  console.error(`\n${real} REAL seam disagreement(s): brick that should match and does not.`);
  process.exit(1);
}
console.log('\nno two faces that should draw the same brick draw different brick');
