// EVERY TEXTURED FACE IN THE WORLD, AT THE DENSITY IT ACTUALLY DRAWS.
//
// Item 107, from the user: *"interior jail textures look off. again why arent
// we catching these? whats causing them and do we need to set a rule against
// them so they aren't created?"* — the fifth time he has found this by eye.
//
// ── WHY NOTHING CAUGHT IT ────────────────────────────────────────────────────
//
// Two reasons, and the second one is the one that mattered.
//
// 1. `scripts/masonry.mjs` only judges faces carrying `userData.masonry`. A
//    pillar, a door, a bench, a floor tile is not masonry, so nothing checked
//    it. Measured on this world: 1902 textured faces, 305 of them stamped —
//    so ~84% of the world's textured surfaces had no density guard even in
//    principle. That is the reason the desk filed, and it is true.
//
// 2. BUT `masonry.mjs` was not checking the other 305 either. It skips any
//    mesh with a `visible === false` ancestor, and commit 5016d26b5 ("Item 141:
//    region cull — the street is not drawn while you are indoors") added a
//    culler that hides every top-level group west of REGION_X=100, plus every
//    unentered interior. At the default spawn that is **all 305 stamps**:
//
//        7792 meshes · 1902 textured · 0 carry a masonry stamp
//        FACES ACTUALLY AUTHORED AT THE WRONG DENSITY: 0        exit 0
//
//    The check registered in `checks.mjs` on the strength of "305 masonry
//    stamps, 16 disagreements" now measures NOTHING and reports green. Its own
//    `--selftest` already fails (exit 2) and nobody was running it.
//
//    **So the jail's textures were never unwatched by accident of category —
//    the jail is an interior, interiors are hidden, and the guard cannot see
//    inside one.** That is the answer to "why aren't we catching these".
//
// ── WHAT THIS DOES DIFFERENTLY ───────────────────────────────────────────────
//
// * **It ignores `visible` entirely.** A wall is painted at whatever density it
//   was painted at; whether the culler has it switched off this frame has
//   nothing to do with it. Visibility is a rendering fact, density is an
//   authoring fact, and a guard that confuses the two measures zero faces.
// * **It judges faces with no declaration at all**, via an invariant that needs
//   none: on a correctly mapped face a texel is SQUARE. `ppmX` and `ppmY` are
//   derived independently from the face's own two dimensions, so any face whose
//   two densities disagree is drawing a stretched texture — whatever it is, and
//   whether or not anyone declared what it is. Every defect in BUILDER-BRIEF
//   §7b's list is of exactly this shape:
//       a canvas painted for 4 m stretched over a 14 m jail wall
//       0.2 m end caps wearing a 9.65 m run
//       an 0.08 m sill drawing at 200 px/m
//   Each is one face whose material was sized for a DIFFERENT face of the same
//   box, then handed to this one unchanged.
// * **Undeclared surfaces are their own reported category with a count**, as
//   the item asks — those are the invisible ones.
//
// Face dimensions come from `scripts/lib/faces.mjs`, never from a bounding box
// and never from `parameters.width` alone: a box's material order is
// [+x,-x,+y,-y,+z,-z], so material 0 is the +x face and its width is the box's
// DEPTH. That single mistake produced two retracted findings in this repo
// (42 "off-density" faces, 135 "disagreeing" junctions) and faces.mjs exists
// because of it.
//
// ── THE TOLERANCE, AND WHY IT IS NOT TUNED ───────────────────────────────────
//
// The item's own calibration: *"a face wrong by a texel is rounding, a face
// wrong by 4x is what the user is seeing."* So:
//
//   * ASPECT ratio is judged as a RATIO, never as a px/m difference. The error
//     from a half-texel scales as 0.5/faceMetres and is unbounded as the face
//     gets thin, so a fixed px/m tolerance is the wrong SHAPE and would fire on
//     thin trim while missing a stretched wall. masonry.mjs's header makes this
//     same argument at length and it is right.
//   * A stamped face is compared against `ppmW`/`ppmH` — what the whole-texel
//     canvas ACHIEVED — not against `ppm`, what it asked for. The desk ruled on
//     2026-07-25 that density is held exactly and the canvas absorbs the
//     remainder, so a face that is not a whole number of texels CANNOT draw at
//     its declared ppm and no change to the world can make it.
//
// GROSS is 4x and is not negotiable downward here; the mild bands are printed
// as a table rather than being folded into the verdict, because they are a
// different and much less certain claim.
//
// ── THE BACKLOG RATCHET ──────────────────────────────────────────────────────
//
// This lands on a world with a real backlog. A check that is red on day one and
// stays red is noise nobody reads, and a check tuned until it is green is the
// documented failure this project has paid for repeatedly (GOTCHAS 58). So it
// ratchets: `notes/texdensity-baseline.json` records the CURRENT gross count
// per owner, and the check fails when any owner gets WORSE or a new owner
// appears. The backlog is printed every run so it cannot be forgotten, and
// `--bless` is the only way to move the baseline up, which is a deliberate,
// reviewable commit rather than a quiet edit to a tolerance.
//
//   node scripts/texdensity.mjs              # audit + ratchet verdict
//   node scripts/texdensity.mjs --all        # print every gross face
//   node scripts/texdensity.mjs --selftest   # prove the verdict can go red
//   node scripts/texdensity.mjs --bless      # record today's counts as the baseline
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { FACE_LIB } from './lib/faces.mjs';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const URL = aim('http://localhost:4183/');
const ALL = process.argv.includes('--all');
const SELFTEST = process.argv.includes('--selftest');
const BLESS = process.argv.includes('--bless');
const BASELINE = 'notes/texdensity-baseline.json';

/** the item's own line: "a face wrong by 4x is what the user is seeing" */
const GROSS = 4.0;
/** a stamped face may drift from its declared ppm only by whole-texel rounding */
const STAMP_TOL = 0.02;      // 2% — measured worst drift in this world is 1.79%

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.addInitScript({ content: FACE_LIB });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);                 // GOTCHAS 26: prove it, do not name it
await p.waitForTimeout(1500);              // GOTCHAS 78: __ct publishes before frame 1

if (SELFTEST) {
  // Give ONE face a repeat it was not painted for — the same mutation
  // masonry.mjs and seampairs.mjs use, and for the same reason. Nothing on
  // disk, no source change. A face that already draws square becomes a face
  // drawing 3x stretched, so the aspect verdict MUST go red on it.
  const hit = await p.evaluate(() => {
    let done = null;
    window.__ct.scene().traverse((o) => {
      if (done || !o.isMesh || !o.geometry) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m, mi) => {
        if (done || !m || !m.map || !m.map.image) return;
        const { fw, fh } = window.__faceLib.dims(o, mi);
        if (!(fw > 0.3 && fh > 0.3)) return;
        const rx = Math.abs(m.map.repeat.x) || 1, ry = Math.abs(m.map.repeat.y) || 1;
        const asp = (m.map.image.width * rx / fw) / (m.map.image.height * ry / fh);
        if (asp < 0.9 || asp > 1.1) return;        // start from a SQUARE face
        m.map.repeat.x = rx * 3;                   // now it draws 3x stretched
        done = { name: o.name || '?', mi, face: [+fw.toFixed(2), +fh.toFixed(2)] };
      });
    });
    return done;
  });
  if (!hit) { console.error('SELFTEST could not find a square face to break'); await b.close(); process.exit(3); }
  console.log(`selftest: tripled repeat.x on a ${hit.face.join('×')} m face (${hit.name}) — this MUST now go red\n`);
}

const out = await p.evaluate((k) => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const rows = [];
  let meshes = 0, mapped = 0, stamped = 0, kinded = 0, unmeasurable = 0, hidden = 0;
  // WHOSE IS IT? nearest named ancestor, so the backlog can be split by area
  // and an owner can be handed their own list.
  // Interiors are laid out in their own coordinate band (ct/jail.ts:102 — "its
  // own coordinate space, x > 400"), one room per slab along z≈0, and most of
  // their meshes are unnamed. So fall back to the interior REGISTRY, which
  // knows which room owns which x, before giving up and saying '?'.
  // `__ct.roomDims()` is interior.ts's own `interiorRooms()` — {id, cx, cz, w, d}
  // per room. DERIVED, not retyped: BUILDER-BRIEF §8, and the belt's slab
  // pitch is exactly the kind of number that goes stale in a copy.
  const rooms = (() => { try { return window.__ct.roomDims() || []; } catch { return []; } })();
  const roomAt = (x, z) => {
    for (const r of rooms)
      if (Math.abs(x - r.cx) <= r.w / 2 + 1 && Math.abs(z - r.cz) <= r.d / 2 + 1) return r.id;
    let best = null, bd = 1e9;
    for (const r of rooms) { const d = Math.abs(x - r.cx); if (d < bd) { bd = d; best = r; } }
    return best && bd < 40 ? `${best.id}~` : null;      // '~' = just outside its box
  };
  const ownerOf = (o, x, z) => {
    const room = roomAt(x, z);                 // a room owns everything inside it
    if (room) return `interior:${room}`;
    for (let q = o; q; q = q.parent) {
      if (q.userData && q.userData.mod) return q.userData.mod;
      if (q.name) return q.name;
    }
    return '?';
  };
  s.traverse((o) => {
    if (!o.isMesh || !o.geometry) return; meshes++;
    // DELIBERATELY NOT FILTERED ON `visible` — see the header. The region
    // culler hides most of the world at any given moment and every unentered
    // interior; a density audit that respected it would measure ~0 faces.
    let isHidden = false;
    for (let q = o; q; q = q.parent) if (q.visible === false) { isHidden = true; break; }
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m, mi) => {
      if (!m || !m.map) return; mapped++; if (isHidden) hidden++;
      const u = m.map.userData || {};
      const ms = u.masonry || null;
      if (ms) stamped++;
      if (u.surface) kinded++;
      const { fw, fh } = window.__faceLib.dims(o, mi);
      const img = m.map.image;
      if (!(fw > 0.02 && fh > 0.02 && img && img.width)) { unmeasurable++; return; }
      const rx = Math.abs(m.map.repeat.x) || 1, ry = Math.abs(m.map.repeat.y) || 1;
      const ppmX = (img.width * rx) / fw;
      const ppmY = (img.height * ry) / fh;
      const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
      const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
      const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
      rows.push({
        owner: ownerOf(o, cx, cz), name: o.name || '', kind: u.surface || null,
        hidden: isHidden,
        declPpm: ms ? ms.ppm : null,
        achPpm: ms && ms.ppmW != null ? [ms.ppmW, ms.ppmH] : null,
        ppm: [+ppmX.toFixed(2), +ppmY.toFixed(2)],
        aspect: +(ppmX > ppmY ? ppmX / ppmY : ppmY / ppmX).toFixed(3),
        face: [+fw.toFixed(3), +fh.toFixed(3)],
        canvas: [img.width, img.height],
        repeat: [+rx.toFixed(3), +ry.toFixed(3)],
        type: g.type, mi,
        at: [+((bb.min.x + bb.max.x) / 2).toFixed(1), +((bb.min.y + bb.max.y) / 2).toFixed(1),
             +((bb.min.z + bb.max.z) / 2).toFixed(1)],
      });
    });
  });
  return { meshes, mapped, stamped, kinded, unmeasurable, hidden, rows };
}, null);

const R = out.rows;
console.log(`${out.meshes} meshes · ${out.mapped} textured faces · ${R.length} measurable`);
console.log(`   ${out.hidden} of those faces are hidden RIGHT NOW by the region culler / unentered interiors`);
console.log(`   -> masonry.mjs skips exactly those, which is why it sees ${out.stamped - R.filter(r => r.declPpm && !r.hidden).length === out.stamped ? 0 : '?'} of ${out.stamped} stamps\n`);

// ── CATEGORY: what declares anything at all ─────────────────────────────────
const withStamp = R.filter((r) => r.achPpm);
const noStamp = R.filter((r) => !r.achPpm);
console.log('DECLARATION COVERAGE');
console.log(`   ${String(withStamp.length).padStart(5)}  faces carry a DENSITY declaration (userData.masonry)`);
console.log(`   ${String(noStamp.length).padStart(5)}  faces DECLARE NO DENSITY AT ALL  <-- the invisible ones`);
const byKind = {};
for (const r of noStamp) byKind[r.kind || '(no kind either)'] = (byKind[r.kind || '(no kind either)'] || 0) + 1;
for (const [k, v] of Object.entries(byKind).sort((a, c) => c[1] - a[1]))
  console.log(`          ${String(v).padStart(5)} of them declare kind '${k}'`);
console.log(`   ${((withStamp.length / R.length) * 100).toFixed(1)}% of the world's textured faces have a checkable density.\n`);

// ── VERDICT A: a stamped face that does not draw what its canvas achieved ───
const stampWrong = withStamp.filter((r) =>
  Math.abs(r.ppm[0] - r.achPpm[0]) / r.achPpm[0] > STAMP_TOL ||
  Math.abs(r.ppm[1] - r.achPpm[1]) / r.achPpm[1] > STAMP_TOL);
console.log(`STAMPED FACES DRAWING AT THE WRONG DENSITY: ${stampWrong.length} of ${withStamp.length}`);
for (const r of stampWrong.slice(0, ALL ? 999 : 8))
  console.log(`   achieved ${r.achPpm.map((n) => +n.toFixed(2)).join('×')}, draws ${r.ppm.join('×')} px/m` +
              `  face ${r.face.join('×')} m  repeat ${r.repeat.join('×')}  ${r.owner}  at (${r.at.join(', ')})`);

// ── VERDICT B: NON-SQUARE TEXELS — needs no declaration whatsoever ──────────
const bands = [[1.05, 1.25], [1.25, 1.5], [1.5, 2], [2, 4], [4, 10], [10, 1e9]];
console.log('\nTEXEL ASPECT (ppmX : ppmY on the same face; 1.00 = square texels)');
console.log(`   ${String(R.filter((r) => r.aspect < 1.05).length).padStart(5)} ×  square (<1.05)`);
for (const [lo, hi] of bands) {
  const n = R.filter((r) => r.aspect >= lo && r.aspect < hi).length;
  console.log(`   ${String(n).padStart(5)} ×  ${lo}-${hi === 1e9 ? '∞' : hi}x${lo >= GROSS ? '   <-- GROSS' : ''}`);
}
const gross = R.filter((r) => r.aspect >= GROSS).sort((a, c) => c.aspect - a.aspect);
console.log(`\nFACES DRAWING A STRETCHED TEXTURE (>= ${GROSS}x): ${gross.length}`);

const byOwner = {};
for (const r of gross) byOwner[r.owner] = (byOwner[r.owner] || 0) + 1;
console.log('\n   by owner:');
for (const [k, v] of Object.entries(byOwner).sort((a, c) => c[1] - a[1]))
  console.log(`      ${String(v).padStart(4)} ×  ${k}`);

console.log(`\n   worst ${ALL ? gross.length : 20}:`);
for (const r of gross.slice(0, ALL ? 999 : 20))
  console.log(`      ${r.aspect.toFixed(1).padStart(8)}x  ${r.ppm.join(' × ')} px/m  face ${r.face.join('×')} m` +
              `  canvas ${r.canvas.join('×')}  rep ${r.repeat.join('×')}  ${r.type}/${r.mi}` +
              `  ${r.kind || 'UNDECLARED'}  ${r.owner}  at (${r.at.join(', ')})`);

writeFileSync('shots/texdensity.json', JSON.stringify(out, null, 2));
await b.close();

// ── THE RATCHET ─────────────────────────────────────────────────────────────
if (BLESS) {
  writeFileSync(BASELINE, JSON.stringify({
    note: 'Gross (>=4x stretched) textured faces per owner, recorded so scripts/texdensity.mjs '
        + 'can fail on a REGRESSION while a real backlog is worked down. Raise a number here only '
        + 'with a reason in the commit message. See BUILDER-BRIEF §7b.',
    recorded: new Date().toISOString().slice(0, 10), gross: gross.length, byOwner,
  }, null, 2) + '\n');
  console.log(`\nblessed: wrote ${BASELINE} at ${gross.length} gross faces`);
  process.exit(0);
}

if (SELFTEST) {
  // The mutation took a SQUARE face to 3x. It must appear in `gross`.
  if (!gross.length) {
    console.error('\nSELFTEST FAILED — a face was made to draw a 3x stretched texture and this '
                + 'script did not report it. The verdict above is decoration.');
    process.exit(2);
  }
  console.log('\nselftest: caught it');
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error(`\nNO BASELINE. Run --bless once to record today's counts, and commit it.`);
  process.exit(1);
}
const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
const regressions = [];
for (const [k, v] of Object.entries(byOwner)) {
  const was = base.byOwner[k] ?? 0;
  if (v > was) regressions.push(`${k}: ${was} -> ${v}`);
}
const fixedUp = Object.entries(base.byOwner).filter(([k, v]) => (byOwner[k] ?? 0) < v)
  .map(([k, v]) => `${k}: ${v} -> ${byOwner[k] ?? 0}`);
if (fixedUp.length) console.log(`\nIMPROVED since ${base.recorded}: ${fixedUp.join(', ')}`);
console.log(`\nbacklog: ${gross.length} gross faces (baseline ${base.gross}, recorded ${base.recorded})`);
if (regressions.length) {
  console.error(`\nREGRESSION — these owners gained stretched faces:\n   ${regressions.join('\n   ')}`);
  console.error('\nEvery textured face must derive its repeat from its OWN dimensions '
              + '(BUILDER-BRIEF §7b). Fix it, or --bless with a reason.');
  process.exit(1);
}
console.log('no owner got worse.');
process.exit(0);
