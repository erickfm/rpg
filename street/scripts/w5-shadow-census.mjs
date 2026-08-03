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
// ⚠ ITEM 211: STEP IS NOW **SHADE**, AND IT IS GATED. The two failed
// predicates below are KEPT — do not re-try them — and the clause that finally
// worked is at the bottom of this block and in full at the GRAIN test itself.
//
// I tried twice to make it a check and both predicates were wrong. Written down
// in full because the next person will otherwise try the same two.
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
//   3. RATIO PLUS **GRAIN** — this one works, and the guess above is why.
//      The previous author's untested hunch was that the road is CONTINUOUS
//      and IDENTIFIED: it carries lane markings. That is exactly right and it
//      is MEASURABLE, because markings are the brightest thing on the darkest
//      surface in the world and they land in its texture's standard deviation.
//      Measured on the built bundle with the pre-186 alley floor reconstructed
//      from 2d1edb0ac (`scripts/probes/w70-ground-contrast.mjs`):
//
//        surface                    canvas mean   canvas sd   verdict
//        road (tex-ground 154 m2)          39.4       60.20   approved, never reported
//        alley floor, pre-186              43.2        8.44   the user's SIXTH report
//        sidewalk paving (both abut it)   122.9       12.30   the bright neighbour
//
//      **The road is DARKER than the alley floor was** — 39.4 against 43.2 —
//      which is why no threshold on tone can ever work, and it is the single
//      most useful number in this file. On GRAIN they are nowhere near: the
//      road carries 4.9x its neighbour's structure, the alley floor 0.69x.
//
//      So SHADE is `much darker than what it touches AND flatter than it`.
//      GRAIN = 1.0 is a COMPARISON, not a tuned level: it says "less visible
//      structure than the ground beside it", which is what shade does, because
//      the grade is multiplicative and scales sd by the same factor as mean.
//      Item 186 wrote the mechanism down without naming it as a predicate:
//      *"at 14.8/255 an sd of 8.4 has been compressed to about +/-3 levels:
//      there is no visible structure left."*
//
//      Effect: 29 STEP rows -> 17 SHADE rows, and the road, its four segments
//      and the nine park/church patches all drop out while the reconstructed
//      alley floor is caught at ratio 0.35, grain 0.69.
//
// ── WHAT IS GATED: BARE, SHADE, AND THE POPULATION FLOOR ───────────────────
//
// All three ratchet. BARE's count and area, SHADE's count, and a FLOOR_POP
// under which the run has MEASURED NOTHING and must say so rather than report
// a comfortable zero — the same failure as masonry.mjs in GOTCHAS 79. Watched
// red: commenting out the warp leaves the player indoors, the region cull hides
// the exterior, and the population falls to 41 of 60 and fails naming that.
//
// CLOCK-INVARIANT, and that was not free. Run at 03:00 the count went 17 -> 24,
// and all seven extras were measured against ONE surface — a lamp's spill pool
// at (-34.8, -93), lum 150.7 — whose opacity animates past the 0.6 cut after
// dark, so every dark patch near a lamp acquired a brilliant new neighbour.
// Fixed by asking what the surface IS rather than how opaque it is: additive
// blending is light, not ground. 17 at 13:00 and 17 at 03:00 afterwards.
//
// Usage: SHOT_URL=http://localhost:PORT/ node scripts/w5-shadow-census.mjs
//        --selftest    strip a ground texture, require BARE red
//        --shadetest   darken AND flatten the alley floor, require SHADE red
//                      and require it to NAME that surface
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
  // SHADE is now GATED TOO — item 211. Baselined the same way: lower it when
  // you fix one, never raise it. Taken 2026-08-02 on build 4c1d1ab8b.
  shade: { n: 17 },
};
/** the smallest number of textured ground surfaces a real run examines.
 *  Below this NOTHING WAS MEASURED and the run must fail rather than report a
 *  comfortable zero — the region cull alone can take this to 0 (GOTCHAS 79,
 *  and the warp below exists because it already did). */
const FLOOR_POP = 60;
/** darker than this fraction of a neighbour it abuts = reads as shade on it */
const STEP = 0.45;
/** …AND carrying less absolute grain than that neighbour. See the long note at
 *  the GRAIN clause: this is a comparison, not a tuned level. */
const GRAIN = 1.0;
/** how close two ground footprints must be to count as touching, in metres */
const ABUT = 0.25;
/** …and how much they must overlap along the other axis, so a corner clip is
 *  not read as a shared edge */
const SHARE = 0.5;
/** …and how close their SURFACES must be in height to count as flush. A kerb
 *  is 0.15 m and explains a change of tone; 0.06 m explains nothing. */
const FLUSH = 0.06;

const ARGS = flags(['--selftest', '--shadetest']);
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

// `--shadetest` WINS OVER `--selftest`, and it has to. checks.mjs:1306 appends
// `--selftest` to EVERY row when the suite is run that way, so the SHADE row —
// which is the same script with `--shadetest` — would otherwise receive both.
// BARE's mutation strips the alley floor's map, which removes it from SHADE's
// population entirely, and the shade assertion would then fail for the wrong
// reason and read as a broken guard. One mutation per process.
if (ARGS.selftest && !ARGS.shadetest) {
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

if (ARGS.shadetest) {
  // SHADE'S OWN MUTATION, and it must be a DIFFERENT one from BARE's.
  //
  // BARE's selftest strips the map, which is the state BARE counts and which
  // SHADE cannot see at all (a surface with no map has no mean to compare).
  // So SHADE gets the mutation that reproduces the defect it was built for:
  // repaint a ground texture DARKER AND FLATTER — multiply every texel toward
  // its own mean and then scale the lot down — which is precisely what the
  // pre-186 alley floor was, and precisely what a cast shadow does.
  //
  // Asserting the SPECIFIC surface reappears, not merely that the count is
  // non-zero: GOTCHAS 79's second corollary is a selftest that passed
  // vacuously because it asserted `gross.length`, which was 188 whatever you
  // did to the world.
  const hit = await page.evaluate(() => {
    const sc = window.__ct.scene(); sc.updateMatrixWorld(true);
    let done = null;
    sc.traverse((o) => {
      if (done || !o.isMesh || !o.geometry) return;
      if (o.userData?.alley !== 'floor') return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!m || !m.map || !m.map.image) return;
      const im = m.map.image;
      const cv = document.createElement('canvas');
      cv.width = im.width; cv.height = im.height;
      const g = cv.getContext('2d', { willReadFrequently: true });
      g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, im.width, im.height);
      const p = d.data;
      let sum = 0, n = 0;
      for (let i = 0; i < p.length; i += 4) { sum += 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]; n++; }
      const mean = sum / n;
      // pull each texel 70% of the way to the mean (flatten), then scale the
      // whole canvas to 0.33 of its brightness (darken)
      for (let i = 0; i < p.length; i += 4) {
        for (let k = 0; k < 3; k++) {
          const v = p[i + k];
          p[i + k] = Math.max(0, Math.min(255, Math.round((mean + (v - mean) * 0.30) * 0.33)));
        }
      }
      g.putImageData(d, 0, 0);
      m.map.image = cv;
      m.map.needsUpdate = true; m.needsUpdate = true;
      done = `the alley floor (${im.width}x${im.height}, mean ${mean.toFixed(1)} -> ~${(mean * 0.33).toFixed(1)})`;
      done += ` at ${o.getWorldPosition(new (sc.position.constructor)()).x.toFixed(1)}`;
    });
    return done;
  });
  if (!hit) { console.error('  SHADETEST FOUND NOTHING TO DARKEN — it would pass having mutated nothing'); await browser.close(); process.exit(2); }
  console.log(`  SHADETEST: darkened and flattened ${hit} — SHADE must go up AND name it\n`);
}

const r = await page.evaluate(({ ABUT, SHARE, STEP, GRAIN }) => {
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
    // A LAMP SPILL IS NOT GROUND, AND AN OPACITY THRESHOLD CANNOT SAY SO.
    //
    // Found by running this census at 03:00 instead of 13:00: the count went
    // 17 -> 24, and all seven extra pairs were measured against one surface,
    // `props` at (-34.8, -93) with lum 150.7 — a lamp's pool on the pavement.
    // It ANIMATES: its opacity is under 0.6 by day, so the line above drops it,
    // and over 0.6 after dark, so it becomes "ground" and every genuinely dark
    // patch near a lamp acquires a brilliant new neighbour to be compared with.
    //
    // The clock is pinned at 13:00 twenty lines up, so this never bit a real
    // run — but a check whose answer depends on a constant somewhere else in
    // the file is one edit from being wrong, and the fix is not another
    // threshold. Ask what the surface IS: `ct/props.ts:414` already identifies
    // light with `m.blending === AdditiveBlending`, and vice.ts's `spill()` and
    // `glowM()` both build exactly that. Light added to a surface is not a
    // surface. (Same argument as GOTCHAS 79: `visible` is a rendering fact and
    // almost everything a check wants is an authoring one.)
    if (mat.blending === 2 /* THREE.AdditiveBlending */) return;
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
      const lo2 = Math.min(a.mean, b.mean), hi2 = Math.max(a.mean, b.mean);
      if (hi2 <= 1) continue;
      const ratio = lo2 / hi2;
      if (ratio >= STEP) continue;
      const dark = a.mean < b.mean ? a : b, light = a.mean < b.mean ? b : a;
      // ── GRAIN: THE CLAUSE THAT SEPARATES A SHADOW FROM A ROAD ────────────
      //
      // FLUSH used to be here and it was WRONG — see the header. It asked
      // whether the two surfaces are level, on the argument that a kerb is a
      // real 0.15 m object that explains a change of tone while a shadow has no
      // thickness. It cut the nonsense pairings, and then the selftest went
      // green because the alley floor's top sits 0.07 m below the walk's: the
      // clause excluded the one surface it was built for.
      //
      // The signal is not TONE and it is not HEIGHT. It is STRUCTURE, and item
      // 186 wrote it down without naming it as a predicate:
      //
      //   "At 14.8/255 an sd of 8.4 has been compressed to about +/-3 levels:
      //    THERE IS NO VISIBLE STRUCTURE LEFT, so what is on the screen is a
      //    black shape with a clean edge lying over the paving."
      //
      // A surface stops reading as a MATERIAL and starts reading as a SHAPE
      // when it carries less absolute grain than the ground it touches — which
      // is exactly what shade does, because the world's grade is multiplicative
      // and scales a surface's sd by the same factor as its mean. A different
      // material has no such relation, and a road has the opposite one: its
      // lane markings are the brightest thing on it.
      //
      // MEASURED, on the built bundle, with the pre-186 alley floor
      // reconstructed from 2d1edb0ac (scripts/probes/w70-ground-contrast.mjs):
      //
      //   surface                    canvas mean   canvas sd   verdict
      //   road  (tex-ground 154 m2)         39.4       60.20   approved, never reported
      //   alley floor, pre-186              43.2        8.44   the user's SIXTH report
      //   sidewalk paving (both abut it)   122.9       12.30   the bright neighbour
      //
      // The road is DARKER than the alley floor was — 39.4 against 43.2 — which
      // is why two ratio-based attempts failed and why no threshold on tone can
      // ever work. On grain they are not close: the road carries 4.9x the
      // sidewalk's structure and the alley floor carried 0.69x.
      //
      // So the test is a COMPARISON, not a magic number: `darker AND flatter
      // than what it touches`. GRAIN = 1.0 is the statement "less structure
      // than its neighbour", not a level tuned until something passed.
      if (dark.sd === null || light.sd === null) continue;
      if (light.sd <= 0) continue;
      const grain = dark.sd / light.sd;
      if (grain >= GRAIN) continue;
      steps.push({ ratio: +ratio.toFixed(3), grain: +grain.toFixed(2), indoor: dark.indoor,
        darkMod: dark.mod, darkArea: +dark.area.toFixed(1), darkMean: dark.mean, darkSd: dark.sd,
        darkAt: `${dark.x}, ${dark.z}`, darkName: dark.name,
        lightMod: light.mod, lightMean: light.mean, lightSd: light.sd, lightAt: `${light.x}, ${light.z}` });
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
    texturedGroundN: ground.filter((g) => g.mean !== null).length,
  };
}, { ABUT, SHARE, STEP, GRAIN });

console.log(`\n  BARE — ground-facing surfaces with no texture at all`);
console.log(`  ${r.total} meshes, ${r.area.toFixed(0)} m2   (of ${r.groundN} ground-facing surfaces in all)`);
console.log(`  outdoor: ${r.outdoorN} meshes, ${r.outdoorArea.toFixed(0)} m2`);
console.log(`  indoor:  ${r.indoorN} meshes, ${r.indoorArea.toFixed(0)} m2\n`);
console.log('  zone     module            count      m2   biggest   at');
for (const m of r.mods)
  console.log(`  ${m.zone.padEnd(8)} ${m.mod.padEnd(16)} ${String(m.n).padStart(5)}  ${m.area.toFixed(0).padStart(6)}` +
              `  ${m.big.toFixed(1).padStart(7)}   ${m.at}`);

console.log(`\n  SHADE — GATED (item 211): ground painted darker than ${STEP} of ground it`);
console.log(`        touches AND carrying less grain than it — see the GRAIN clause.`);
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
// THE POPULATION FLOOR COMES FIRST, and it is not a formality. Both censuses
// report a comfortable ZERO when they see nothing, and this world can hand them
// nothing for two documented reasons: the region cull hides the whole exterior
// while the player is indoors (the warp above exists because a run from the
// spawn measured the apartment), and GOTCHAS 79 is the same failure in
// masonry.mjs, which printed "0 faces at the wrong density" for weeks while
// examining 0 faces. A run that examined fewer surfaces than the world has
// MEASURED NOTHING, and that is a different answer from "found nothing".
if (r.texturedGroundN < FLOOR_POP) {
  fails.push(`only ${r.texturedGroundN} textured ground surfaces were examined, under the `
    + `floor of ${FLOOR_POP} — NOTHING WAS MEASURED. Check the warp landed outdoors and `
    + `that the region cull is not hiding the exterior (GOTCHAS 79).`);
}
if (r.total > BASE.bare.n) fails.push(`BARE count ${r.total} is above the baseline ${BASE.bare.n}`);
if (r.area > BASE.bare.m2) fails.push(`BARE area ${r.area.toFixed(0)} m2 is above the baseline ${BASE.bare.m2} m2`);
// THE SHADETEST ASSERTS THE SURFACE IT DARKENED, not merely that the count
// moved. GOTCHAS 79's second corollary: texdensity's first selftest asserted
// `gross.length`, which was 188 whatever you did, and passed vacuously.
if (ARGS.shadetest) {
  const named = r.steps.find((s) => s.darkAt === '-10.3, -40.3');
  if (!named) {
    fails.push('SHADETEST darkened the alley floor and SHADE did not name it — '
      + 'the mutation was not caught, whatever the count did');
  } else {
    console.log(`  SHADETEST CAUGHT IT: ${named.darkMod} at ${named.darkAt}, `
      + `ratio ${named.ratio}, grain ${named.grain}`);
  }
}
if (r.steps.length > BASE.shade.n)
  fails.push(`SHADE count ${r.steps.length} is above the baseline ${BASE.shade.n} — `
    + `a piece of ground is painted darker AND flatter than the ground it touches`);
console.log('');
if (fails.length) {
  for (const f of fails) console.log(`FAIL  ${f}`);
  console.log('      A flat colour is not a material, and a piece of ground much darker than');
  console.log('      the ground beside it is a painted shadow. Helpers: walkTex/apronTex/');
  console.log('      plazaTex in ct/tex-ground.ts, slabTex in ct/paint.ts.');
  console.log('      For SHADE specifically: DO NOT add grain to fix it. The grade is');
  console.log('      multiplicative, so grain on a surface painted at a third of its');
  console.log('      neighbour is scaled away with everything else — that is item 186s');
  console.log('      whole finding. Raise the BASE COLOUR until the mean lands beside the');
  console.log('      surface it abuts.');
} else {
  console.log(`census within baseline — BARE ${r.total}/${BASE.bare.n} meshes,`
    + ` ${r.area.toFixed(0)}/${BASE.bare.m2} m2;  SHADE ${r.steps.length}/${BASE.shade.n}`
    + `   (${r.texturedGroundN} textured ground surfaces examined).`);
  if (r.total < BASE.bare.n || r.area < BASE.bare.m2 - 1 || r.steps.length < BASE.shade.n)
    console.log('  IT HAS IMPROVED — lower the BASE constants at the top of this file.');
}
await browser.close();
process.exit(fails.length ? 1 : 0);
