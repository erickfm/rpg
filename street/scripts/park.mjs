// feat/park — is the park lit, and are the lamps beside the path?
//
// The auditor's finding was "NOT lit — ZERO light sources; black at night", so
// the first thing this asserts is that there ARE emitters and that the ground
// under them is not black. The second thing matters more for keeping it right:
// the lamp positions are DERIVED from ctx.site('park') using ct/park.ts's own
// offsets, and the park has been re-cut twice — so this checks each lamp
// actually stands beside the loop, and fails loudly if E moves it rather than
// quietly lighting the grass.
//
// Usage: SHOT_URL=http://localhost:4279/ node scripts/park.mjs
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(aim('http://localhost:4177/'), { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, aim('http://localhost:4177/'));   // GOTCHAS 26: prove it, do not just name it
await page.evaluate(() => window.__ct.clock(2, 30));
await page.waitForTimeout(1600);

const r = await page.evaluate(() => {
  const sc = window.__ct.scene();
  // the park's own ground plane tells us the site without trusting a constant
  // BY AREA, not by height. This used to require the plane's y to equal 0.14
  // to within 1e-6, two lines under a comment promising not to trust a
  // constant, and the file already records being burned once by an exact-match
  // predicate that reported ZERO lamps in a park that had ten.
  //
  // I tried to replace it with the world's own groundAt(x, z) — the affordance
  // two other builders adopted this week — and that was WRONG, loudly and
  // usefully. groundAt at the park centre returns 0.403 against a slab at
  // 0.140. Sampled on a grid it moves smoothly — 0.347 / 0.363 / 0.403 / 0.413
  // / 0.437 across four metres, down to 0.104 at the park edge — so the park
  // GROUND IS A MOUND and the flat 32 x 30 plane is the base under it. Nothing
  // is wrong; the two numbers are simply about different things, and a plane's
  // y has no reason to equal the terrain height at its own centre.
  //
  // (I nearly routed that 0.26 m gap to the park's owner as a floating-floor
  // bug. It is not one. Sampling a second point before writing the note is what
  // stopped it.)
  //
  // Then the tight tolerance turned out to be doing real work. There are TWO
  // planes here that pass the size and x filters — 32 x 30 at y 0.140 and
  // 17.75 x 16.5 at y 0.143 — and 1e-6 excluded the second. Any looser
  // tolerance matches both, the traverse keeps the LAST one, and every
  // measurement below silently becomes about a site half the size. That is a
  // worse failure than the one I set out to fix, and it would have been green.
  //
  // So neither constant nor picker: take the LARGEST candidate. It is
  // deterministic regardless of traverse order, indifferent to the floor
  // height, and the two candidates differ by more than 3x in area.
  let site = null, bestArea = 0;
  sc.traverse((o) => {
    const g = o.geometry?.parameters;
    if (!o.isMesh || !g || o.geometry.type !== 'PlaneGeometry') return;
    if (o.position.x > -8) return;
    if (g.width < 15 || g.height < 15) return;
    const area = g.width * g.height;
    if (area <= bestArea) return;
    bestArea = area;
    site = { minX: o.position.x - g.width / 2, maxX: o.position.x + g.width / 2,
             minZ: o.position.z - g.height / 2, maxZ: o.position.z + g.height / 2,
             y: +o.position.y.toFixed(4), area };
  });
  // Park lanterns, found BY TAG. This matched an exact 0.22 x 0.20 x 0.22 lens
  // box and reported ZERO lamps the moment that geometry changed — in a park
  // that had ten of them, with the change being a bug fix to those very lamps.
  // props.ts sets userData.parkLantern, which cannot go stale when a box is
  // resized.
  const lamps = [];
  sc.traverse((o) => {
    if (o.userData?.parkLantern)
      lamps.push([+o.position.x.toFixed(2), +o.position.z.toFixed(2), +o.position.y.toFixed(2)]);
  });
  // how bright is the park ground at 3am? sample the material of its floor
  let floorLum = null, floorArea = 0;
  sc.traverse((o) => {
    const g = o.geometry?.parameters;
    if (!o.isMesh || !g || o.geometry.type !== 'PlaneGeometry') return;
    if (o.position.x > -8) return;
    if (g.width < 15 || g.height < 15) return;
    const area = g.width * g.height;
    if (area <= floorArea) return;            // the same slab the site came from
    floorArea = area;
    const c = o.material.color;
    floorLum = +(0.299 * c.r + 0.587 * c.g + 0.114 * c.b).toFixed(4);
  });
  // additive emitters that actually carry opacity right now
  let lit = 0;
  const emitters = [];
  sc.traverse((o) => {
    if (o.isMesh && o.material?.blending === 2 && o.material.opacity > 0.05 &&
        o.position.x < -8 && o.position.x > -40) {
      lit++; emitters.push([o.position.x, o.position.z]);
    }
  });
  // PER LANTERN, NOT A TOTAL. `lit` is a count over the whole park, and the bar
  // on it was 8 while the world lights 20 — so six lanterns could go black and
  // the remaining four would clear it. This park is the one the auditor found
  // "NOT lit — ZERO light sources" and the user called the shittiest he had
  // seen; a check on it that tolerates most of the lamps failing is not
  // checking the thing that was wrong.
  //
  // Each lantern carries a halo and a ground pool. Pair emitters to lanterns by
  // position and report the WORST-lit lantern, which is the only number that
  // can say "they are all emitting".
  const perLamp = lamps.map(([lx, lz]) =>
    emitters.filter(([ex, ez]) => Math.hypot(ex - lx, ez - lz) < 1.2).length);
  return { site, lamps, floorLum, lit, perLamp, darkest: perLamp.length ? Math.min(...perLamp) : 0 };
});

console.log(`\n  park site: x ${r.site?.minX} … ${r.site?.maxX}, z ${r.site?.minZ} … ${r.site?.maxZ}`);
console.log(`  park lanterns: ${r.lamps.length}`);
console.log(`  additive emitters carrying light inside the park at 3am: ${r.lit}`);
console.log(`  park ground material luminance at 3am: ${r.floorLum}`);

// the loop, by ct/park.ts's own rule
// A NULL SITE IS A FAILURE, NOT A CRASH. This read r.site.minX straight out and
// died with `Cannot read properties of null` the moment my own edit stopped the
// predicate matching. A stack trace is not a verdict: the runner prints it as a
// failed check with no line saying WHAT was wrong, and a reader has to open the
// file to learn that the park was never found.
if (!r.site) {
  console.error('\n  FAIL no park ground slab found — nothing west of x -8 is a');
  console.error('  PlaneGeometry of at least 15 x 15 m. Every verdict below would');
  console.error('  have been about an empty site, so none of them are printed.');
  await browser.close();
  process.exit(1);
}
console.log(`  park site: the largest slab, ${r.site.area.toFixed(0)} m2 at y ${r.site.y}`);
const lx0 = r.site.minX + 3.2, lx1 = r.site.maxX - 0.25 - 1.35;
const lz0 = r.site.minZ + 1.7, lz1 = r.site.maxZ - 1.7;
// distance from a point to the loop rectangle's PERIMETER
const toLoop = (x, z) => {
  const onLeg = (a, b, c) => Math.abs(a - b) <= 0 ? Infinity : 0;
  const dLegs = [
    Math.abs(x - lx0) + Math.max(0, Math.max(lz0 - z, z - lz1)),
    Math.abs(x - lx1) + Math.max(0, Math.max(lz0 - z, z - lz1)),
    Math.abs(z - lz0) + Math.max(0, Math.max(lx0 - x, x - lx1)),
    Math.abs(z - lz1) + Math.max(0, Math.max(lx0 - x, x - lx1)),
  ];
  return Math.min(...dLegs);
};
const offs = r.lamps.map(([x, z]) => +toLoop(x, z).toFixed(2));
const worst = Math.max(...offs);
console.log(`  each lantern's distance from the loop path: ${offs.join(', ')}`);

// TEN, and it is structural rather than a magic number: ct/props.ts builds four
// lanterns per leg on two legs, plus one at each end of the loop "so the corners
// are not the dark bit". That count does not move when E re-cuts the park — the
// legs get longer, not more numerous — so a floor of 8 bought nothing except
// room for the two END lamps to disappear unnoticed, which is exactly the
// failure the comment that placed them was written to prevent.
const okCount = r.lamps.length >= 10;
const okLit = r.lit >= 8;
// whatever lanterns the park has — the count follows E's site cut — every one
// of them must be carrying light, not just enough of them to reach a total
const okEach = r.perLamp.length > 0 && r.darkest >= 1;

// IS ANYTHING DRAWN ON TOP OF THAT LIGHT? Emitting and being seen are different
// claims, and this file only made the first one.
//
// The pool decal is additive with depthWrite off, but it still depth-TESTS, and
// opaque geometry draws first — so anything lying above it simply stops the
// lamplight where they cross, leaving a dark patch inside a lit pool. This is
// the same class as the gutter decals that were buried under the pan (8a50f971a):
// the material is present, carries opacity, and is invisible.
//
// It had happened here. ct/park.ts separates its coplanar ground detail on a
// LIFT = 0.006 unit — field 0.5, paths 1.0, litter 1.5, bald ring 2.0, desire
// lines 2.5 — and my pool sat at +0.02 off the base slab, INSIDE that stack.
// Three of ten pools were partly covered by desire-line panels at y 0.176
// against a decal at 0.160: 11.96 m2 of overlap, worst patch 3.61 m2 of a
// 19.36 m2 pool. Raising the decal to +0.05 clears the stack by 14 mm.
//
// 5% is the bar. The residual today is a single 2.4 x 0.18 m strip at y 0.23
// taking 0.38 m2 — 2.0% of one pool — which is a real object standing proud of
// the ground rather than ground detail, and not worth floating the light higher
// to chase. The state this catches is the one that just happened: a fifth of a
// pool gone.
const cover = await page.evaluate(() => {
  const sc = window.__ct.scene(); const pools = [], solids = [];
  sc.traverse((o) => {
    if (!o.isMesh) return;
    const w = o.getWorldPosition(new (o.position.constructor)());
    if (w.x > -7 || w.x < -40 || w.z > -66 || w.z < -100 || w.y > 1.0) return;
    const g = o.geometry?.parameters; if (!g) return;
    if (o.material?.blending === 2) pools.push({ x: w.x, z: w.z, y: w.y, w: g.width ?? 0 });
    else if ((o.material?.opacity ?? 1) > 0.999 && !o.material?.transparent && (g.width ?? 0) >= 0.5)
      solids.push({ x: w.x, z: w.z, y: w.y, w: g.width, h: g.height ?? g.width });
  });
  return pools.map((p) => {
    const area = p.w * p.w; let covered = 0;
    for (const q of solids) {
      // WITHIN A HAND'S BREADTH, or it is not a layering fault. First pass
      // counted every opaque mesh under y 1.0, which called a bench seat at
      // 0.57 "drawn on top of the lamplight" and reported 11.1% on two pools.
      // A bench standing in a pool of light is the world working; a desire-line
      // panel 16 mm above the decal is the bug. 0.10 m separates them.
      if (q.y <= p.y + 1e-6 || q.y - p.y > 0.10) continue;
      // A LID, NOT AN EDGE. A 2D footprint overlap cannot tell "lying on top
      // of" from "standing beside": a kerb line measured 12 x 0.12 m and a
      // basin grate bar 0.56 x 0.01 m both overlap a decal's footprint while
      // occluding nothing. Found by running this same test over my ground
      // decals — 12 of 26 showed coverage, every one of them a thin strip
      // contributing 0.01-0.04 m2, and none of it real.
      // Both dimensions must be at least 0.3 m before this counts as a lid.
      // The park's residual 2% was exactly this artefact: a 2.4 x 0.18 m strip.
      if (q.w < 0.3 || q.h < 0.3) continue;
      const ox = Math.min(p.x + p.w / 2, q.x + q.w / 2) - Math.max(p.x - p.w / 2, q.x - q.w / 2);
      const oz = Math.min(p.z + p.w / 2, q.z + q.h / 2) - Math.max(p.z - p.w / 2, q.z - q.h / 2);
      if (ox > 0 && oz > 0) covered += ox * oz;
    }
    return { at: `${p.x.toFixed(1)},${p.z.toFixed(1)}`, pct: area ? +(100 * covered / area).toFixed(1) : 0 };
  });
});
// AND THE GROUND ITSELF, not just things lying on it. The park is a MOUND —
// groundAt runs from 0.104 at the edge to 0.403 at the centre — while the pool
// decal is a flat plane. A raise anywhere under a pool puts the light inside the
// hill, and the coverage test above cannot see that: it looks for opaque meshes
// drawn over the decal, and terrain is not a mesh it samples.
//
// Checked this by hand twice, two rounds apart, and both times only because I
// happened to read a mainline commit that mentioned the park's ground —
// b29b2e9aa raised it beside a barrier. Twice is the point at which noticing by
// chance stops being a method.
const sunk = await page.evaluate(() => {
  const sc = window.__ct.scene(); const pools = [];
  sc.traverse((o) => {
    if (!o.isMesh || o.material?.blending !== 2) return;
    const w = o.getWorldPosition(new (o.position.constructor)());
    if (w.x > -7 || w.x < -40 || w.z > -66 || w.z < -100 || w.y > 1.0) return;
    const g = o.geometry?.parameters; if (!g?.width) return;
    pools.push({ x: w.x, z: w.z, y: w.y, w: g.width });
  });
  return pools.map((p) => {
    let under = 0; const N = 7, h = p.w / 2;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const gy = window.__ct.groundAt(p.x - h + (p.w * i) / (N - 1), p.z - h + (p.w * j) / (N - 1));
      if (typeof gy === 'number' && isFinite(gy) && gy > p.y) under++;
    }
    return { at: `${p.x.toFixed(1)},${p.z.toFixed(1)}`, pct: Math.round((under / (N * N)) * 100) };
  });
});
const worstSunk = sunk.length ? Math.max(...sunk.map((s) => s.pct)) : 100;
const okSunk = sunk.length > 0 && worstSunk === 0;
console.log(`  ${okSunk ? 'OK  ' : 'FAIL'} no lamp pool is inside the hill it lights ` +
  `(worst ${worstSunk}% of a pool under the terrain, of ${sunk.length} pools)`);
for (const t of sunk.filter((t) => t.pct > 0)) console.log(`      ${t.at}: ${t.pct}% below groundAt`);

const worstCover = cover.length ? Math.max(...cover.map((c) => c.pct)) : 0;
const okCover = cover.length > 0 && worstCover <= 5;
console.log(`  ${okCover ? 'OK  ' : 'FAIL'} nothing is drawn on top of the lamplight ` +
  `(worst pool ${worstCover}% covered, of ${cover.length} pools)`);
for (const c of cover.filter((c) => c.pct > 0)) console.log(`      ${c.at}: ${c.pct}% under near-ground geometry`);
const okBeside = worst <= 1.3;             // beside it, not on it and not adrift
const okClear = Math.min(...offs) >= 0.75; // off the 1.5 m path itself
console.log(`\n  ${okCount ? 'OK  ' : 'FAIL'} the park HAS light sources (${r.lamps.length})`);
console.log(`  ${okLit ? 'OK  ' : 'FAIL'} they are emitting at 3am (${r.lit} sheets lit)`);
console.log(`  ${okEach ? 'OK  ' : 'FAIL'} EVERY lantern is carrying light ` +
  `(worst has ${r.darkest} emitter${r.darkest === 1 ? '' : 's'}; per lamp ${r.perLamp.join(',')})`);
console.log(`  ${okBeside ? 'OK  ' : 'FAIL'} every lantern stands beside the loop (worst ${worst} m)`);
console.log(`  ${okClear ? 'OK  ' : 'FAIL'} none stands ON the 1.5 m path (nearest ${Math.min(...offs)} m)`);

// AND WALK PAST THEM. This check knew where the lanterns stand and never once
// tried to get past one, which is not good enough for ten new colliders on a
// path — the project's rule is that anything involving movement is verified by
// walking it, and "0.95 m from the path centre" is arithmetic, not a walk.
//
// It was builder E's own park walk that showed this up: E's instrument walks
// all four legs and mine did not walk any. My own ad-hoc attempt earlier had
// measured distance along z only, so a run that drifted 22 m sideways off the
// leg still counted as a pass. Distance travelled is not the same as getting
// there.
await page.evaluate(() => window.__ct.clock(13, 0));
await page.waitForTimeout(700);
await page.mouse.click(500, 310);
const leg = async (label, x, z, yaw, secs, axis, want) => {
  await page.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0.14, 0), [x, z, yaw]);
  await page.waitForTimeout(160);
  const a = await page.evaluate(() => window.__ct.pos());
  await page.keyboard.down('w');
  await page.waitForTimeout((secs - 1.5) * 1000);
  const b2 = await page.evaluate(() => window.__ct.pos());     // 1.5 s from the end
  await page.waitForTimeout(1500);
  await page.keyboard.up('w');
  const c = await page.evaluate(() => window.__ct.pos());
  const along = Math.abs(axis === 'x' ? c[0] - a[0] : c[2] - a[2]);
  const drift = Math.abs(axis === 'x' ? c[2] - a[2] : c[0] - a[0]);
  const lastBit = Math.hypot(c[0] - b2[0], c[2] - b2[2]);
  // DISTANCE ALONE WAS ONE PEDESTRIAN FROM FLIPPING, and had already flipped.
  // Measured over four runs, the northbound legs came in at 12.7, 16.0, 18.8
  // and 19.6 m against a 16 m line while southbound sat at 25-29 m. The park
  // loop has citizens walking it; one standing in a 1.5 m path stops the
  // player for a few seconds and the distance collapses. That is not a floor
  // defect, which is the only thing this leg is asking about.
  //
  // So ask what bfd0b7ae asked of lotwalk: not how far it got, but whether it
  // was STOPPED. Still moving when the clock ran out means the lane is open
  // and the distance was only ever a time budget. Dead still means blocked.
  const moving = lastBit > 0.8;
  const ok = drift < 1.2 && (along > want || moving);
  const why = ok ? (along > want ? '' : ' (short, but still moving — path open)') : '';
  console.log(`  ${ok ? 'OK  ' : 'STUCK'} ${label}: ${along.toFixed(1)} m along, ${drift.toFixed(2)} m off the leg, ${lastBit.toFixed(2)} m in the last 1.5 s${why}`);
  return ok;
};
console.log('\n  walking the loop past the lanterns:');
let walked = true;
// THE LEGS COME OFF THE PATH NOW, not off two remembered x values.
//
// 1da5e891 re-cut the loop — brought in off the boundary, corners turned — and
// these walked straight lines at lx0/lx1 for a fixed 6 s. A loop with corners
// cannot be walked straight, so the walker left the path and stopped against
// the boundary at 12.3 m and 10.9 m, identically on every run. They still
// PASSED, because 12.3 clears an 8 m bar: a check reporting success for a walk
// that no longer followed the thing it is named after.
//
// The loop publishes its own shape. Its long straights are 1.5 m wide path
// slabs, and the hold is derived from the one being walked rather than chosen:
// 80% of its length at the rig's ~2.9 m/s, so the walker covers the straight
// and does not run into the corner at the end of it. A re-cut moves the legs
// with it — and this park has now been re-cut three times.
const straights = await page.evaluate(() => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    const g = o.geometry?.parameters;
    if (!o.isMesh || !g || o.geometry.type !== 'PlaneGeometry') return;
    if (o.position.x > -8 || o.position.x < -42) return;
    if (Math.abs(o.position.y - 0.146) > 0.006) return;
    if (Math.abs(g.width - 1.5) > 0.01 || g.height < 8) return;   // a long run, not a corner
    out.push({ x: +o.position.x.toFixed(2), z: +o.position.z.toFixed(2), len: +g.height.toFixed(2) });
  });
  return out.sort((a, b) => a.x - b.x);
});
console.log(`  loop straights found: ${straights.map((s) => `${s.len} m at x ${s.x}`).join(', ') || 'NONE'}`);
if (straights.length < 2) {
  console.log('  FAIL fewer than two long straights — the loop is not walkable as legs');
  walked = false;
} else {
  for (const st of straights) {
    const secs = Math.max(3, Math.min(9, (st.len * 0.8) / 2.9));
    const want = st.len * 0.55;
    const half = st.len / 2 - 0.6;
    walked = await leg(`x ${st.x} leg, south to north`, st.x, st.z - half, Math.PI, secs, 'z', want) && walked;
    walked = await leg(`x ${st.x} leg, north to south`, st.x, st.z + half, 0, secs, 'z', want) && walked;
  }
}

// AND KEEP THEM OFF THE GATE ENTRY.
//
// E's park quality pass found "the gate lamp stands on the entry centreline"
// and generously took it as theirs rather than mine. Measured: it is not one of
// mine — my nearest lantern is 3.3 m from the centreline and no collider
// crosses it at all. But the park has been re-cut twice, my lanterns are placed
// by formula off ctx.site('park'), and a third re-cut could walk one straight
// into the entry without anything noticing. So the check asserts it now.
//
// The entry is found rather than assumed: it is the narrow path quad that
// reaches the street edge at site.maxX.
const entry = await page.evaluate(([maxX, legX, minX, minZ, maxZ]) => {
  const sc = window.__ct.scene();
  let best = null; const cand = [];
  sc.traverse((o) => {
    const g = o.geometry?.parameters;
    if (!o.isMesh || !g || o.geometry.type !== 'PlaneGeometry') return;
    if (Math.abs(o.position.y - 0.1445) > 0.02) return;
    // NARROW IN ONE AXIS, not small in both. This rejected anything over 4 m
    // either way, and the entry spur is 5.25 x 1.9 — so the detector could
    // never have found it, whatever the loop did. The audit read the miss as
    // "the loop moved away from the boundary", which was true and was not the
    // reason: the size filter excluded the target from the start.
    //
    // A path is a STRIP. What identifies one is that its short side is about a
    // path's width, not that both sides are short.
    if (!g.width || !g.height) return;
    const short = Math.min(g.width, g.height), long = Math.max(g.width, g.height);
    if (short > 2.6 || long < 1.2) return;
    // THE MOST STREET-WARD PATH SLAB, not "one touching the street edge".
    // 1da5e891 brought the loop in off the boundary and turned its corners, so
    // the entry stopped touching maxX and this went blind — it refused to
    // answer rather than passing, which is the only reason the change was
    // visible at all, but a detector keyed to a boundary the design has moved
    // away from is a remembered coordinate wearing a filter.
    //
    // Derive it: whichever path piece reaches furthest toward the street IS the
    // way in, wherever the loop sits. That survives the park being re-cut,
    // which it has been three times.
    // AND IT MUST ACTUALLY BE THE WAY IN. "Whichever path piece reaches
    // furthest toward the street" is not enough on its own: with the size
    // filter widened it started answering z -96.90, a strip at the park's far
    // south end, and PASSED on it — which is worse than the refusal it
    // replaced, because a wrong answer is not visible as one.
    //
    // The entry is the piece that BRIDGES the boundary and the loop: its
    // street-ward edge reaches the site's own edge, and its centre lies
    // outboard of the loop's street leg. Both facts come from the world, not
    // from a remembered coordinate.
    // IN THE PARK. The traverse walks the whole world and nothing here bounded
    // it, so "whichever path piece reaches furthest toward the street" was
    // answering with quads at x 24, 27 and 51 — the far end of the SIDE STREET,
    // thirty to sixty metres outside the park. That is why it kept reporting an
    // entry at z -96.90 and passing on it. A locator with no bounds is not a
    // locator.
    if (o.position.x < minX || o.position.x > maxX + 0.6) return;
    if (o.position.z < minZ || o.position.z > maxZ) return;
    const reach = o.position.x + g.width / 2;
    if (reach < maxX - 0.35) return;               // it does not touch the street
    if (o.position.x < legX) return;               // it is not outboard of the loop
    cand.push({ z: +o.position.z.toFixed(2), x: +o.position.x.toFixed(2),
      w: +g.width.toFixed(2), h: +g.height.toFixed(2), reach: +reach.toFixed(2) });
    if (!best || reach > best.reach) {
      best = { z: o.position.z, d: short, x: o.position.x, reach };
    }
  });
  return { best, all: cand.sort((a, b) => b.reach - a.reach).slice(0, 6) };
}, [r.site.maxX, straights.length ? Math.max(...straights.map((q) => q.x)) : r.site.maxX - 6,
  r.site.minX, r.site.minZ, r.site.maxZ]);
// Say what it found, and — when it is ambiguous — what else it considered.
// A locator that names one object is checkable; one that silently picks a
// winner from a field is how this came to answer with a quad on the side
// street and pass on it.
const ent2 = entry?.best ?? null;
if ((entry?.all?.length ?? 0) > 1) {
  console.log('  NOTE more than one candidate for the entry:', JSON.stringify(entry.all));
}
if (!ent2) {
  // EXIT 3, NOT 1. GOTCHAS §32: 1 means the world is wrong, and this message
  // already says the opposite — that the check could not answer. The auditor
  // caught it reading as a world failure when the locator was the thing that
  // had broken, which is the exact confusion the code exists to prevent.
  console.error('\n  INCONCLUSIVE could not find the gate entry path — this check cannot answer');
  process.exitCode = 3;
} else {
  const clear = r.lamps.map(([x, z]) => +Math.abs(z - ent2.z).toFixed(2));
  const nearest = Math.min(...clear);
  const ok = nearest > ent2.d / 2 + 0.6;
  console.log(`\n  gate entry at z ${ent2.z.toFixed(2)}, ${ent2.d.toFixed(2)} m wide`);
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} no lantern stands on the entry (nearest is ${nearest} m off its centreline)`);
  if (!ok) process.exitCode = 1;
}

const shot = async (n, x, z, tx, tz, gy, p2) => {
  await page.evaluate(([x, z, tx, tz, gy, p2]) =>
    window.__ct.warp(x, z, Math.atan2(tx - x, -(tz - z)), gy, p2), [x, z, tx, tz, gy, p2]);
  await page.waitForTimeout(450);
  await page.screenshot({ path: `shots/pk-${n}.png` });
};
await shot('path-night', lx1, lz0 + 1.5, lx1, lz1, 0.14, -0.02);
await shot('gate-night', r.site.maxX + 1.0, (lz0 + lz1) / 2, lx0, (lz0 + lz1) / 2, 0.14, -0.02);
await shot('across-night', lx0 + 2, lz0 + 2, lx1, lz1, 0.14, 0.0);
await page.evaluate(() => window.__ct.clock(13, 0));
await page.waitForTimeout(900);
await shot('path-day', lx1, lz0 + 1.5, lx1, lz1, 0.14, -0.02);

await browser.close();
if (errors.length) { console.error('\nPAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
if (!okCount || !okLit || !okEach || !okBeside || !okClear || !walked || !okCover || !okSunk) process.exit(1);
console.log('\nno page errors');
