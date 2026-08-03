// WORLD-WIDE SHADOW-GEOMETRY CENSUS — item 0a, registered and ratcheted by
// item 186.
//
// Starts from notes/AUDIT-shadow-geometry.md's predicate ("131 meshes,
// ~1092 m2" against build 55c7df614: largest face horizontal, world y in
// [-0.35, 0.55], area >= 1 m2, material.map absent on at least one
// submaterial) but corrects ONE bug in it, found by running it here: "absent
// on at least one submaterial" flags a box's DARK RISER SIDES even when its
// TOP face — the only face anyone ever sees, the one slabTex/walkTex paints —
// carries a real map. That is exactly the GOTCHAS box-top-face trap in
// reverse (flat-ground.mjs's comment: "Box top faces are material index 2 —
// read mats[0] and civic vanishes"), and it is why this script's first run
// counted the entire west sidewalk slab (245 m2, one box, top properly
// textured) as a shadow-geometry offender. Fixed by reading the TOP-FACING
// material specifically: index 2 of a 6-entry box array, or mats[0] for a
// near-flat plane — same rule flat-ground.mjs already proved outdoors, now
// applied world-wide (indoor + outdoor) rather than its |x|<=100 outdoor-only
// scope, which is why the two totals still legitimately disagree.
//
// ── WHY THERE ARE TWO CENSUSES HERE, AND WHY THE SECOND ONE HAD TO EXIST ───
//
// The user reported this class for the SIXTH time on 2026-08-02 — *"get rid of
// shadow texture here pls"*, at the alley mouth — and **this script, run on
// that exact world, was green on that exact surface.**
//
// BARE only asks `is there a map?`. The alley floor HAS one: 158 x 156 at
// 24 px/m, and measured, it carries **19.4% relative grain against the
// sidewalk's 9.7%** — twice as much. It was not missing grain. It was painted
// at mean luminance **43.3 where the sidewalk is 123.5**, and in his own frame,
// after the world's grade, those rendered as **14.8 against 49.6**: a black
// shape with a hard straight arris across it. That is a painted shadow, and
// `!mat.map` is structurally blind to it.
//
// So a check that only counts BARE quads can be green for ever while he keeps
// reporting the same thing, which is precisely how this reached six reports.
//
// STEP is the second census and it asks the question his sentence actually
// asks: **is this piece of ground much darker than the ground it touches?**
// The world's grade (`ct/props.ts`) is MULTIPLICATIVE and bottoms out at
// FLOOR_GROUND = 0.045, so absolute brightness is meaningless — at 3 a.m. every
// ground surface in the world is nearly black on purpose. A RATIO between
// neighbours is the one thing the grade cannot change.
//
// ⚠ STEP IS A DIAGNOSTIC AND NOT A GATE, AND THAT IS A REPORTED FAILURE
// RATHER THAN A DESIGN. I tried twice to make it a check and both predicates
// were wrong. Written down in full because the next person will otherwise try
// the same two.
//
//   1. RATIO ALONE. I set the threshold at 0.45 on the argument that the
//      road-against-kerb step was 0.50 — the darkest ground transition anybody
//      had approved — so 0.45 would sit safely under it. **Measured on the live
//      world the road is 0.36 to 0.41 of the walk beside it, DARKER than the
//      0.35 alley floor the user rejected.** The complaint and the approved
//      surface are the same number. A ratio cannot tell them apart at all.
//
//   2. RATIO PLUS FLUSH. The next idea was that a kerb is a 0.15 m step, a real
//      object that explains a change of tone, while a shadow has no thickness —
//      so require the two surfaces to be level. It cut the count from 77 to 28
//      and removed the nonsense pairings, which looked like progress. **Then
//      the selftest went green: the alley floor's top is 0.07 m below the
//      walk's, so the clause excludes the very surface it was built for.**
//
// So the honest state is: there is no working detector for the DARK variant of
// this class, and the reason the user has reported it six times is that nobody
// has built one — not that anybody ignored him. The numbers a third attempt
// needs are all printed below. My own guess, untested: what separates the road
// from the alley is not tone or height but that the road is CONTINUOUS and
// IDENTIFIED — it carries lane markings, a camber and kerbs on both sides — and
// the alley floor is an isolated patch with a straight edge and nothing on it.
// That is a much harder predicate and it is not one I could write and prove in
// this item.
//
// ── WHAT IS GATED: THE BARE RATCHET ────────────────────────────────────────
//
// BARE's count and area are BASELINED below and this script fails when either
// goes UP. That is what item 186 asked for, it is stable across runs, and
// `--selftest` proves it bites by stripping the map off a painted ground
// surface. STEP prints and is not gated — a number I cannot defend as a
// threshold must not become a red light somebody learns to ignore
// (BUILDER-BRIEF §7, GOTCHAS 58, and this script's own note above about
// masonry.mjs crying wolf on 42 of 109 faces).
//
// Usage: SHOT_URL=http://localhost:PORT/ node scripts/w5-shadow-census.mjs
//        --selftest   darken a painted ground surface, require red
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { goto } from './lib/reachable.mjs';
import { reportWorld } from './lib/which-world.mjs';
import { setClock } from './lib/clock.mjs';
import { flags } from './lib/args.mjs';

// ── THE BASELINE. Lower these when you fix something; never raise them. ────
//
// Taken 2026-08-02 on build 2d1edb0ac, after item 186's alley-floor fix, with
// the world standing OUTDOORS (see the warp below — the region cull hides the
// whole exterior while you are in flat 301, and a census taken from the spawn
// measures the apartment).
//
// Against B's original figure of 123 surfaces / 454 m2, quoted in
// ct/paint.ts:56: BARE is now 62 / 145 m2, and 61 of the 62 are INDOOR — the
// street, the lot, the park and the civic forecourt have one bare surface
// between them. Which of the four complaints that 123 was named for are
// actually closed is in notes/w64-shadow-census.md.
const BASE = {
  bare: { n: 62, m2: 146 },     // ground-facing surfaces with no map at all
  // STEP has no baseline on purpose: it is printed, not gated. See the header.
};
/** darker than this fraction of a neighbour it abuts = reads as shade on it */
const STEP = 0.45;
/** how close two ground footprints must be to count as touching, in metres */
const ABUT = 0.25;
/** …and how much they must overlap along the other axis, so a corner clip is
 *  not read as a shared edge */
const SHARE = 0.5;
/** …and how close their SURFACES must be in height to count as flush. A kerb
 *  is 0.15 m and explains a change of tone; 0.06 m explains nothing. */
const FLUSH = 0.06;

const ARGS = flags(['--selftest']);
const URL = aim('http://localhost:4177/');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 500 } });
// SEED Math.random BEFORE THE WORLD IS BUILT, exactly as scripts/scenedump.mjs
// does and for the same reason. `dither()` paints with UNSEEDED Math.random on
// purpose (ct/paint.ts:4), so a texture's mean luminance differs a little on
// every page load — and with a ratchet on a COUNT, a pair sitting near the 0.45
// threshold flips in and out with it. Measured before seeding: three identical
// runs gave STEP 28, 28, 29. Test-harness only; the shipped world keeps its
// live grain.
await page.addInitScript(() => {
  let s = 0x9e3779b9 >>> 0;
  Math.random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
});
await goto(page, URL);
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, URL);
// STAND IN THE STREET. `crosstown.ts`'s region cull sets `visible = false` on
// the entire exterior while the player is indoors, and the world starts in flat
// 301 — so a census run from the spawn walks the apartment and reports the
// street as absent. It cost twenty minutes to notice on 2026-08-02.
await page.evaluate(() => window.__ct.warp(-2, 0, 0, 0));
await page.waitForTimeout(900);
await setClock(page, 13, 0);

if (ARGS.selftest) {
  const hit = await page.evaluate(() => {
    const s = window.__ct.scene(); s.updateMatrixWorld(true);
    let done = null;
    s.traverse((o) => {
      if (done || !o.isMesh || !o.geometry) return;
      if (o.userData?.alley !== 'floor') return;          // the alley floor, by its own tag
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!m || !m.map) return;
      // STRIP THE MAP, which is exactly the state BARE counts. Mutating the
      // material's COLOUR would change nothing this check reads — `lumOf`
      // ignores the tint because updateRain owns it — and the selftest would
      // "pass" having tested nothing (GOTCHAS 34, the trap I-flatground's own
      // note records falling into).
      const was = `${m.map.image?.width}x${m.map.image?.height}`;
      m.map = null; m.needsUpdate = true;
      done = `the alley floor (${was})`;
    });
    return done;
  });
  console.log(`  SELFTEST: stripped the texture off ${hit} — BARE must go up\n`);
  if (!hit) { console.error('  SELFTEST FOUND NOTHING TO STRIP — it would pass having mutated nothing'); await browser.close(); process.exit(2); }
}

const r = await page.evaluate(({ ABUT, SHARE, STEP, FLUSH }) => {
  // Effective daylight luminance of a ground surface: its texture's own mean
  // times the material tint it is multiplied by. Read at 13:00, where the
  // world's grade is 1, so this is the ALBEDO and not the lighting.
  const lumOf = (m) => {
    if (!m || !m.color) return null;
    // THE TEXTURE ONLY, NEVER THE MATERIAL TINT — and that is not a shortcut,
    // it is what makes this number repeatable. `updateRain` in ct/props.ts owns
    // `m.color` on every wet-registered surface and rewrites it every frame as
    // the ground wets and dries, so a census that folded the tint in measured
    // THE WEATHER: two runs a minute apart gave STEP counts of 30 and 31 with
    // nothing changed. A canvas is painted once at load and does not move.
    if (!m.map || !m.map.image) return { mean: null, sd: 0, mapped: false };
    const im = m.map.image;
    if (!im.width || !im.height) return { mean: null, sd: 0, mapped: false };
    const cv = document.createElement('canvas');
    cv.width = im.width; cv.height = im.height;
    const g = cv.getContext('2d', { willReadFrequently: true });
    try { g.drawImage(im, 0, 0); } catch { return { mean: null, sd: 0, mapped: true }; }
    let d; try { d = g.getImageData(0, 0, im.width, im.height).data; } catch { return { mean: null, sd: 0, mapped: true }; }
    let sum = 0, sum2 = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      sum += l; sum2 += l * l; n++;
    }
    const mean = sum / n;
    return { mean, sd: Math.sqrt(Math.max(0, sum2 / n - mean * mean)), mapped: true };
  };
  const rows = [], ground = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    for (let q = o; q; q = q.parent) if (q.visible === false) return;
    o.updateMatrixWorld(true);
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox, m = o.matrixWorld;
    const lo = bb.min.clone().applyMatrix4(m), hi = bb.max.clone().applyMatrix4(m);
    const cx = (lo.x + hi.x) / 2, cy = (lo.y + hi.y) / 2, cz = (lo.z + hi.z) / 2;
    const dx = Math.abs(hi.x - lo.x), dy = Math.abs(hi.y - lo.y), dz = Math.abs(hi.z - lo.z);
    if (cy < -0.35 || cy > 0.55) return;               // world y band
    // "largest face horizontal": the x-z footprint area beats both side areas
    const areaXZ = dx * dz, areaXY = dx * dy, areaZY = dz * dy;
    if (areaXZ < areaXY || areaXZ < areaZY) return;
    if (areaXZ < 1) return;                             // >= 1 m2
    // GOTCHAS 4: a strip under ~0.3 m in its narrow in-plane dimension cannot
    // hold texture detail without aliasing — texturing it would not read as
    // paving, it would read as noise. Found live: 13 "street" hits here were
    // all long (~13 m), 0.09-0.20 m WIDE facade trim/belt-course bands, not
    // ground. Excluding them is not loosening the check (BRIEF 7) — it is the
    // documented exemption the audit itself flagged but never applied.
    if (Math.min(dx, dz) < 0.3) return;
    // GROUND IS THIN. Without this the census counts FURNITURE: a library bench
    // is 0.92 x 3.2 m with a horizontal top, its centre sits at y 0.37 inside
    // the band, and its footprint beats both side areas — so it passed every
    // clause above. Measured: 46 of the 64 indoor hits were table and bench
    // tops in the library and the diner, wearing `int-library.ts`'s own `wood`
    // (#6b5334) and `woodDark` (#4a3826). A slab of paving is at most a few
    // centimetres deep; 0.35 m clears the deepest real ground box in the world
    // (the sidewalk's 0.10 m) by a wide margin and excludes anything standing
    // on legs.
    if (dy > 0.35) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    // READ THE TOP-FACING MATERIAL, not "any submaterial" — a box's dark
    // riser sides are legitimately flat and unmapped; only the top is ground.
    let mat = null;
    if (o.geometry.type === 'BoxGeometry' && mats.length >= 3) mat = mats[2];
    else mat = mats[0];
    if (!mat) return;
    if (mat.transparent && (mat.opacity ?? 1) < 0.6) return; // decals, contact shadows
    let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
    const indoor = Math.abs(cx) > 196 || Math.abs(cz) > 500;
    const L = lumOf(mat);
    const col = (() => { const mt = mats.find((x) => x && x.color); return mt ? '#' + mt.color.getHexString() : '?'; })();
    // EVERY ground-facing surface goes into `ground`, mapped or not — the STEP
    // census is about how they compare, so it needs the good ones too.
    ground.push({ mod: mod ?? '(unattributed)', indoor, area: areaXZ, col,
      x0: Math.min(lo.x, hi.x), x1: Math.max(lo.x, hi.x),
      z0: Math.min(lo.z, hi.z), z1: Math.max(lo.z, hi.z),
      x: +cx.toFixed(1), z: +cz.toFixed(1), top: Math.max(lo.y, hi.y),
      mean: L && L.mean !== null ? +L.mean.toFixed(1) : null,
      sd: L && L.mean !== null ? +L.sd.toFixed(1) : null,
      mapped: !!(L && L.mapped), name: o.name || o.geometry.type });
    if (mat.map) return;
    rows.push({ mod: mod ?? '(unattributed)', area: areaXZ, x: +cx.toFixed(1), z: +cz.toFixed(1),
                indoor, col, name: o.name || o.geometry.type });
  });

  // ── STEP: which ground abuts much darker ground? ────────────────────────
  const steps = [];
  for (let i = 0; i < ground.length; i++) {
    for (let j = i + 1; j < ground.length; j++) {
      const a = ground[i], b = ground[j];
      if (a.mean === null || b.mean === null) continue;
      if (a.indoor !== b.indoor) continue;
      // touching: a gap under ABUT on one axis, with a real shared run on the
      // other. Both orders, because either can be the thin gap.
      const gapX = Math.max(a.x0 - b.x1, b.x0 - a.x1);
      const gapZ = Math.max(a.z0 - b.z1, b.z0 - a.z1);
      const runX = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const runZ = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
      // NEARLY TOUCHING ON BOTH AXES, and sharing a real run on one. The first
      // cut only required a small gap on ONE axis with a shared run on the
      // other, and a 126 m sidewalk slab then "abutted" a car-lot bay 13 m away
      // because their z ranges overlapped: 77 hits, most of them nonsense.
      if (gapX > ABUT || gapZ > ABUT) continue;
      if (runX < SHARE && runZ < SHARE) continue;
      // FLUSH, and this is the clause that separates a shadow from a road.
      //
      // The road IS much darker than the kerb beside it — measured, 0.36 — and
      // nobody has ever called the road a shadow, while the alley floor at 0.35
      // drew the sixth report of this class. A ratio alone cannot tell those
      // two apart, so a ratio-only check would be red on the road for ever and
      // would have to be weakened until it passed. What differs is the EDGE: a
      // kerb is a 0.15 m step, a real object that explains the change of tone,
      // and the alley meets the walk flush, so the tone changes with nothing to
      // change it. A flush join between two very different tones is what a
      // shadow looks like, because a shadow has no thickness.
      if (Math.abs(a.top - b.top) > FLUSH) continue;
      const lo2 = Math.min(a.mean, b.mean), hi2 = Math.max(a.mean, b.mean);
      if (hi2 <= 1) continue;
      const ratio = lo2 / hi2;
      if (ratio >= STEP) continue;
      const dark = a.mean < b.mean ? a : b, light = a.mean < b.mean ? b : a;
      steps.push({ ratio: +ratio.toFixed(3), indoor: dark.indoor,
        darkMod: dark.mod, darkArea: +dark.area.toFixed(1), darkMean: dark.mean,
        darkAt: `${dark.x}, ${dark.z}`, darkName: dark.name,
        lightMod: light.mod, lightMean: light.mean, lightAt: `${light.x}, ${light.z}` });
    }
  }
  // one row per DARK surface — a patch touching three neighbours is one defect
  const seen = new Map();
  for (const s of steps.sort((a, b) => a.ratio - b.ratio)) {
    const k = `${s.darkMod}|${s.darkAt}|${s.darkName}`;
    if (!seen.has(k)) seen.set(k, s);
  }

  const by = {};
  for (const q of rows) {
    const zone = q.indoor ? 'indoor' : 'outdoor';
    const key = `${zone}:${q.mod}`;
    by[key] ??= { zone, mod: q.mod, n: 0, area: 0, big: 0, at: '' };
    const e = by[key];
    e.n++; e.area += q.area;
    if (q.area > e.big) { e.big = q.area; e.at = `${q.x}, ${q.z}`; }
  }
  return {
    total: rows.length, area: rows.reduce((a, q) => a + q.area, 0),
    outdoorN: rows.filter(q => !q.indoor).length, outdoorArea: rows.filter(q => !q.indoor).reduce((a,q)=>a+q.area,0),
    indoorN: rows.filter(q => q.indoor).length, indoorArea: rows.filter(q => q.indoor).reduce((a,q)=>a+q.area,0),
    mods: Object.values(by).sort((a, b) => b.area - a.area),
    rows, groundN: ground.length, steps: [...seen.values()],
  };
}, { ABUT, SHARE, STEP, FLUSH });

console.log(`\n  BARE — ground-facing surfaces with no texture at all`);
console.log(`  ${r.total} meshes, ${r.area.toFixed(0)} m2   (of ${r.groundN} ground-facing surfaces in all)`);
console.log(`  outdoor: ${r.outdoorN} meshes, ${r.outdoorArea.toFixed(0)} m2`);
console.log(`  indoor:  ${r.indoorN} meshes, ${r.indoorArea.toFixed(0)} m2\n`);
console.log('  zone     module            count      m2   biggest   at');
for (const m of r.mods)
  console.log(`  ${m.zone.padEnd(8)} ${m.mod.padEnd(16)} ${String(m.n).padStart(5)}  ${m.area.toFixed(0).padStart(6)}` +
              `  ${m.big.toFixed(1).padStart(7)}   ${m.at}`);

console.log(`\n  STEP — DIAGNOSTIC ONLY, not gated: ground painted darker than ${STEP} of`);
console.log(`         level ground it touches. See the header for why this is not a check.`);
console.log(`  ${r.steps.length} surface(s)\n`);
for (const s of r.steps)
  console.log(`  ${(s.indoor ? 'in ' : 'out')} ratio ${s.ratio.toFixed(2)}  ${s.darkMod.padEnd(14)}`
    + ` ${s.darkArea.toFixed(1).padStart(6)} m2 at ${s.darkAt}  lum ${String(s.darkMean).padStart(6)}`
    + `   against ${s.lightMod} at ${s.lightAt}, lum ${s.lightMean}`);

if (process.env.CENSUS_DETAIL) {
  console.log('\n  --- full BARE row detail ---');
  for (const q of r.rows) console.log(`  ${(q.indoor?'in ':'out')} ${q.mod.padEnd(14)} ${q.area.toFixed(1).padStart(6)} m2  at ${q.x},${q.z}  ${q.col}  ${q.name}`);
}

// ── THE RATCHET ────────────────────────────────────────────────────────────
const fails = [];
if (r.total > BASE.bare.n) fails.push(`BARE count ${r.total} is above the baseline ${BASE.bare.n}`);
if (r.area > BASE.bare.m2) fails.push(`BARE area ${r.area.toFixed(0)} m2 is above the baseline ${BASE.bare.m2} m2`);
// STEP is deliberately NOT in this list — see the header.
console.log('');
if (fails.length) {
  for (const f of fails) console.log(`FAIL  ${f}`);
  console.log('      A flat colour is not a material, and a piece of ground much darker than');
  console.log('      the ground beside it is a painted shadow. Helpers: walkTex/apronTex/');
  console.log('      plazaTex in ct/tex-ground.ts, slabTex in ct/paint.ts.');
} else {
  console.log(`census within baseline — BARE ${r.total}/${BASE.bare.n} meshes,`
    + ` ${r.area.toFixed(0)}/${BASE.bare.m2} m2   (STEP ${r.steps.length}, diagnostic).`);
  if (r.total < BASE.bare.n || r.area < BASE.bare.m2 - 1)
    console.log('  IT HAS IMPROVED — lower the BASE constants at the top of this file.');
}
await browser.close();
process.exit(fails.length ? 1 : 0);
