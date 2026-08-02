// WHICH GROUND SURFACES IN THE LOT ARE FLAT COLOUR?
//
// The user: the driveway apron is *"a large flat untextured grey plane"*, and
// B's diagnosis of the class is the thing worth carrying: *"a flat colour is
// not a material. an untextured quad has no grain for the eye to attach to and
// no joints to give it scale, so it reads as a TINT OVER the paving rather
// than as a piece of paving."*
//
// ── this predicate is the hard part, and A got it wrong three times ──
//
// `notes/A-flat-ground-routing.md` records three attempts that each swept in
// something else — roofs at y 1.6, then CARS (1.8 x 4.5 at y 0.59), and all
// three missed civic entirely because its offenders are BOX TOP FACES in a
// materials array and the probe was reading mats[0]. A published no number
// because of it, which was the right call.
//
// So this one:
//   · takes the material that actually paints the UPWARD face — index 2 of a
//     materials array, per three.js's [+x,-x,+y,-y,+z,-z] order — not mats[0]
//   · counts a plane only when it is actually lying down (world normal within
//     30 deg of +y), so fences, banners and signs cannot enter
//   · excludes anything inside a car group, which is what ate A's second attempt
//   · reports AREA in square metres, because "12 surfaces" and "82 m2" are
//     different claims and the second is the one that matters
//
// Usage: SHOT_URL=http://127.0.0.1:4191/ node scripts/I-flatground.mjs
//        --selftest   strip a texture off a painted ground surface, require red
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { flags } from './lib/args.mjs';

const ARGS = flags(['--selftest']);
const URL = aim('http://127.0.0.1:4191/');
const MOD = process.env.I_MOD ?? 'lot';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);

if (ARGS.selftest) {
  const n = await p.evaluate((MOD) => {
    const s = window.__ct.scene(); s.updateMatrixWorld(true);
    let done = 0;
    s.traverse((o) => {
      if (done || !o.isMesh) return;
      let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
      if (mod !== MOD) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const m = mats.length > 2 ? mats[2] : mats[0];
      if (!m || !m.map) return;
      // DIMENSIONS FROM THE QUAD, not from a local bounding box. A
      // PlaneGeometry lies in its own xy, so `max.z - min.z` is 0 and every
      // candidate scored 0 area — the mutation silently stripped nothing and
      // the check "passed its selftest" by never being mutated at all.
      const gp = o.geometry.parameters ?? {};
      const qw = gp.width ?? 0, qd = (o.geometry.type === 'BoxGeometry' ? gp.depth : gp.height) ?? 0;
      if (qw * qd < 1.5) return;                   // a big one, so it is unmistakable
      m.map = null; m.needsUpdate = true; done = 1;
    });
    return done;
  }, MOD);
  console.log(`  SELFTEST: stripped the texture off ${n} painted ground surface — this must go red\n`);
}

const found = await p.evaluate((MOD) => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const carRoots = new Set();
  const inCar = (o) => { for (let q = o.parent; q; q = q.parent) if (carRoots.has(q)) return true; return false; };
  // cars first, so the ground pass can exclude them — A's second attempt
  // counted 1.8 x 4.5 m car flanks as ground at y 0.59
  s.traverse((o) => {
    if (!o.isGroup) return;
    let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
    if (mod !== 'lot' || inCar(o)) return;
    let n = 0; o.traverse((c) => { if (c.isMesh) n++; });
    if (n >= 8) carRoots.add(o);
  });

  const out = [];
  s.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    for (let q = o; q; q = q.parent) if (q.visible === false) return;
    let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
    if (mod !== MOD || inCar(o)) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if (bb.min.y > 1.2) return;                    // not ground; roofs and signage
    const w = bb.max.x - bb.min.x, d = bb.max.z - bb.min.z, h = bb.max.y - bb.min.y;

    const isPlane = g.type === 'PlaneGeometry';
    const isBox = g.type === 'BoxGeometry';
    if (!isPlane && !isBox) return;

    // IS THE UPWARD FACE ACTUALLY FACING UP? For a plane, take its own normal
    // (local +z) through the world matrix. A fence panel and a deck decal are
    // both thin quads and only this separates them.
    const e = o.matrixWorld.elements;
    if (isPlane) {
      const ny = e[9] / (Math.hypot(e[8], e[9], e[10]) || 1);
      if (Math.abs(ny) < 0.866) return;            // more than 30 deg off vertical-up
    } else if (h > 1.2) return;                    // a tall box is furniture, not ground

    // THE MATERIAL THAT PAINTS THE UP FACE. three.js orders a box's materials
    // [+x, -x, +y, -y, +z, -z], so the top is index 2 — reading mats[0] is what
    // made civic invisible to A's census.
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const m = isBox && mats.length > 2 ? mats[2] : mats[0];
    if (!m) return;
    // AREA FROM THE QUAD, NEVER FROM THE WORLD BOX. The bay stripes are
    // 0.09 x 5.0 m planes raked 0.55 rad, so their world AABB is 2.69 x 4.31
    // and my first run called each one 11.59 m2 — twelve of them, 139 m2, and
    // a headline of "142 m2 of flat colour" that was almost entirely paint
    // stripes measured as if they were slabs. It is the same axis-aligned-box
    // mistake I spent item 2 taking apart, made by me one item later.
    const gp = g.parameters ?? {};
    const qw = gp.width ?? w, qd = isBox ? (gp.depth ?? d) : (gp.height ?? d);
    const area = qw * qd;
    if (area < 0.5) return;                        // not worth a texture
    if (Math.min(qw, qd) < 0.35) return;           // a painted LINE, not a surface
    out.push({ textured: !!m.map, area: +area.toFixed(2), w: +qw.toFixed(2), d: +qd.toFixed(2),
      y: +bb.min.y.toFixed(2), x: +((bb.min.x + bb.max.x) / 2).toFixed(1),
      z: +((bb.min.z + bb.max.z) / 2).toFixed(1),
      geo: g.type, color: m.color?.getHexString?.() ?? '?' });
  });
  return out;
}, MOD);

const bare = found.filter((f) => !f.textured).sort((a, b2) => b2.area - a.area);
const painted = found.filter((f) => f.textured);
const m2 = (a) => a.reduce((s, f) => s + f.area, 0);

console.log(`\n  '${MOD}' ground-facing surfaces: ${found.length}`);
console.log(`     ${painted.length} textured   ${m2(painted).toFixed(1)} m2`);
console.log(`     ${bare.length} FLAT COLOUR ${m2(bare).toFixed(1)} m2\n`);
for (const f of painted)
  console.log(`     ok ${String(f.area).padStart(7)} m2  ${String(f.w).padStart(6)} x ${String(f.d).padStart(6)}`
    + `  at (${f.x}, ${f.z})  y ${f.y}  ${f.geo}`);
for (const f of bare)
  console.log(`     ${String(f.area).padStart(7)} m2  ${String(f.w).padStart(6)} x ${String(f.d).padStart(6)}`
    + `  at (${f.x}, ${f.z})  y ${f.y}  #${f.color}  ${f.geo}`);

if (bare.length) {
  console.log(`\nFAIL  ${bare.length} ground surfaces in '${MOD}' are flat colour (${m2(bare).toFixed(1)} m2).`);
  console.log(`      A flat colour is not a material: no grain to attach to, no joints to give it`);
  console.log(`      scale, so it reads as a tint OVER the paving rather than as paving.`);
  console.log(`      Helpers: apronTex/walkTex/plazaTex in ct/tex-ground.ts, slabTex in ct/paint.ts.`);
} else {
  console.log(`every ground-facing surface in '${MOD}' carries a texture.`);
}

await b.close();
process.exit(bare.length ? 1 : 0);
