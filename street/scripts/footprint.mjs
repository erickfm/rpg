// feat/ground — does anything on the ground straddle a step in it?
//
// Third generation of one bug. Flat-y put decals under the pan; surfaceY(x)
// fixed that by sampling at a POINT; then the litter became 3D solids with
// real extent and a point sample stopped being enough — the fountain cup ended
// up half inside the kerb. This is the check that should have existed after
// the first one, so it is written generally: walk everything near the ground,
// take its real world-space footprint, and ask two questions.
//
//   1. does the footprint CROSS the kerb line at |x| = ROAD_HALF? That is a
//      12 cm cliff and no single y is right for both sides of it.
//   2. is any part of it BELOW the ground under that part?
//
// Usage: SHOT_URL=http://localhost:4279/ node scripts/footprint.mjs
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(page, process.env.SHOT_URL ?? 'http://localhost:4177/');   // GOTCHAS 26: prove it, do not just name it
await page.evaluate(() => window.__ct.clock(13, 0));
await page.waitForTimeout(900);

const r = await page.evaluate(() => {
  const THREE = window.__ct.three ?? null;
  const sc = window.__ct.scene();
  const RH = 5.0, GW = 0.45, KERB = 0.14, CH = 0.0625;
  const surf = (x) => {
    const ax = Math.abs(x);
    if (ax > RH) return KERB;
    if (ax > RH - GW) return 0.006 + (0.018 - 0.006) * ((RH - ax) / GW);
    return 0;
  };
  // the main street only — the side street and the car lot have their own
  // ground and their own owners
  const onStreet = (z, x) => z < 0 && z > -96 && Math.abs(x) < 7.2;

  const out = { litter: [], pits: [], water: [], crossers: [], sunk: [] };
  const box = (o) => {
    o.updateMatrixWorld(true);
    const b = { minX: Infinity, maxX: -Infinity, minY: Infinity };
    const g = o.geometry;
    if (!g) return null;
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox;
    for (const sx of [bb.min.x, bb.max.x]) {
      for (const sy of [bb.min.y, bb.max.y]) {
        for (const sz of [bb.min.z, bb.max.z]) {
          const v = { x: sx, y: sy, z: sz };
          const m = o.matrixWorld.elements;
          const wx = m[0] * v.x + m[4] * v.y + m[8] * v.z + m[12];
          const wy = m[1] * v.x + m[5] * v.y + m[9] * v.z + m[13];
          b.minX = Math.min(b.minX, wx); b.maxX = Math.max(b.maxX, wx);
          b.minY = Math.min(b.minY, wy);
        }
      }
    }
    return b;
  };

  const check = (o, label, bucket) => {
    const b = box(o);
    if (!b) return;
    const p = o.getWorldPosition(new (o.position.constructor)());
    if (!onStreet(p.z, p.x)) return;
    const rec = { label, x: +p.x.toFixed(3), z: +p.z.toFixed(1),
      minX: +b.minX.toFixed(3), maxX: +b.maxX.toFixed(3), minY: +b.minY.toFixed(4) };
    bucket.push(rec);
    for (const line of [RH, -RH]) {
      if (b.minX < line && b.maxX > line) out.crossers.push({ ...rec, line });
    }
    // sunk: the lowest corner is below the ground under the x it sits at.
    // 1 mm of tolerance, because a decal deliberately hugs its surface.
    const worst = Math.max(surf(b.minX), surf(b.maxX));
    if (b.minY < worst - 0.001) out.sunk.push({ ...rec, ground: +worst.toFixed(4) });
  };

  // Everything solid enough to clip against. The FIRST version of the footprint
  // rule only knew about ground surfaces, so a milk crate resolved its height
  // correctly and then grew into a stallriser — a wall is not a surface you can
  // sample a height from, and nothing was asking the question.
  const box3 = (o) => {
    o.updateWorldMatrix(true, false);
    const g = o.geometry; if (!g) return null;
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox, m = o.matrixWorld.elements;
    const r2 = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity,
                 minZ: Infinity, maxZ: -Infinity };
    for (const sx of [bb.min.x, bb.max.x]) for (const sy of [bb.min.y, bb.max.y])
      for (const sz of [bb.min.z, bb.max.z]) {
        const wx = m[0]*sx + m[4]*sy + m[8]*sz + m[12];
        const wy = m[1]*sx + m[5]*sy + m[9]*sz + m[13];
        const wz = m[2]*sx + m[6]*sy + m[10]*sz + m[14];
        r2.minX = Math.min(r2.minX, wx); r2.maxX = Math.max(r2.maxX, wx);
        r2.minY = Math.min(r2.minY, wy); r2.maxY = Math.max(r2.maxY, wy);
        r2.minZ = Math.min(r2.minZ, wz); r2.maxZ = Math.max(r2.maxZ, wz);
      }
    return r2;
  };
  const solids = [];
  sc.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    // A bench leg touching its own seat is construction, not a clip, so
    // nothing tagged counts as a solid to hit — only the world does.
    let p2 = o; let mine = false;
    while (p2) { if (p2.userData?.litter || p2.userData?.groundProp) { mine = true; break; } p2 = p2.parent; }
    if (mine) return;
    // A SPRITE IS NOT A SOLID. Trees, the hydrant and the pigeons are
    // alpha-tested billboards that turn to face the player, so their box is
    // whatever they happen to be facing this frame and they are EXPECTED to
    // overlap the architecture behind them — that is what a cut-out sprite in
    // front of a wall looks like. Counting one as a thing to hit flagged all
    // seven tree pits for being inside their own trees.
    if (o.material?.alphaTest > 0) return;
    const b2 = box3(o); if (!b2 || !isFinite(b2.minX)) return;
    if (b2.maxY - b2.minY < 0.25 || b2.minY > 1.6) return;
    if (b2.maxX - b2.minX > 40 || b2.maxZ - b2.minZ > 60) return;
    solids.push(b2);
  });
  out.clips = [];
  sc.traverse((o) => {
    // litter, and anything else of mine that stands on the ground near the
    // building line. The litter is only the class that failed FIRST; a bench
    // or a tree pit against a facade would clip exactly the same way, and A
    // is still pushing shopfronts further out.
    //
    // The payphone is deliberately not tagged: it is bolted TO a wall, so an
    // intersection with one is the correct state for it.
    if (!o.userData?.litter && !o.userData?.groundProp) return;
    o.traverse((c) => {
      if (!c.isMesh) return;
      const b2 = box3(c); if (!b2) return;
      for (const w of solids) {
        if (b2.maxX <= w.minX || b2.minX >= w.maxX) continue;
        if (b2.maxY <= w.minY || b2.minY >= w.maxY) continue;
        if (b2.maxZ <= w.minZ || b2.minZ >= w.maxZ) continue;
        out.clips.push({ kind: o.userData.litter ?? o.userData.groundProp,
          x: +o.position.x.toFixed(2), z: +o.position.z.toFixed(1) });
        return;
      }
    });
  });

  sc.traverse((o) => {
    if (o.userData?.litter) { o.traverse((c) => { if (c.isMesh) check(c, o.userData.litter, out.litter); }); return; }
    if (!o.isMesh) return;
    const img = o.material?.map?.image;
    // the tree pits: 0.6 x 1.0 planes on the walk
    const gp = o.geometry?.parameters;
    // BY THE STAMP, not by its dimensions. props.ts sets
    // userData.groundProp = 'tree pit' on exactly these meshes and has done all
    // along; this matched a 1.0 m plane instead, so the moment the well changed
    // length the check stopped seeing any pits at all. That is footprint-blind
    // — the case I added after watching this file report every clearance verdict
    // green with ZERO pits found — and I walked straight into it again by
    // lengthening the well to 1.4 m. The population floor caught it, which is
    // the only reason this is a comment rather than a silent pass.
    //
    // The stamp cannot go stale when a dimension moves. glow.mjs learned the
    // same lesson against an exact lens box and reads userData.parkLantern now.
    if (o.userData?.groundProp === 'tree pit') check(o, 'tree pit', out.pits);
    // puddle / track sheets
    if (img && ((img.width === 48 && img.height === 32) || (img.width === 16 && img.height === 64))
        && o.material.transparent && o.position.y < 0.3) check(o, 'water', out.water);
  });
  return out;
});

const n = (a) => a.length;
console.log(`\n  on the main street: ${n(r.litter)} litter meshes, ${n(r.pits)} tree pits, ${n(r.water)} water sheets`);

// DID THIS FIND ANYTHING TO CHECK? Every verdict below is an ABSENCE — nothing
// straddles, nothing is sunk, nothing clips — and an absence is free when the
// population is empty. Watched it happen rather than reasoning about it: widen
// the pit plane from 1.0 m to 1.04 and the predicate at the top of this file no
// longer recognises a tree pit, so
//
//     on the main street: 31 litter meshes, 0 tree pits, 9 water sheets
//     OK  nothing straddles the kerb line (0)      ... every line OK, exit 0
//
// The pits are still there. The user's tree-pit clearance guarantee just stops
// being checked, silently, and the row in checks.mjs stays green. Worse, the
// clearance block is wrapped in `if (r.pits.length)`, so it does not even
// print — there is no output to notice missing.
//
// The canfail case `footprint-pits` does NOT cover this: it moves PIT_X, so the
// pits still match the predicate and are still found. A mutation that keeps the
// population intact cannot prove the population is checked.
//
// Floors, not exact counts — this is guarding against zero and against a
// predicate that has quietly stopped matching, not pinning the street's
// contents.
//
// I wrote these from memory the first time and put pits at 10. The street has
// SEVEN, so my new guard failed the unmutated world on its first run: I had
// written a number instead of measuring one, in the same commit where I fixed a
// check for not measuring. Measured, at HEAD:
//
//     31 litter meshes, 7 tree pits, 9 water sheets
//
// Litter is counted in MESHES, not objects — trash.mjs's 12–20 is the object
// count and each carries several meshes, which is why the two numbers disagree.
const FLOOR = { litter: 15, pits: 5, water: 6 };
let thin = false;
for (const [what, min] of Object.entries(FLOOR)) {
  const got = r[what].length;
  if (got >= min) continue;
  console.log(`  FAIL only ${got} ${what} found, expected at least ${min} — every`
    + ` verdict below is about ${what.toUpperCase()} and passes for free at zero.`);
  console.log(`       Either they are gone from the street, or the predicate at the`
    + ` top of this file no longer recognises them.`);
  thin = true;
}
if (thin) process.exitCode = 1;
else console.log(`  OK   there is a street here to check (${n(r.litter)}/${n(r.pits)}/${n(r.water)} vs floors ${FLOOR.litter}/${FLOOR.pits}/${FLOOR.water})`);

if (r.pits.length) {
  const inner = Math.min(...r.pits.map((p) => Math.abs(p.x) - (Math.abs(p.maxX) - Math.abs(p.x))));
  const gaps = r.pits.map((p) => +(Math.min(Math.abs(p.minX), Math.abs(p.maxX)) - (5.0 + 0.0625)).toFixed(3));
  const lo = Math.min(...gaps), hi = Math.max(...gaps);
  console.log(`  walk between kerb chamfer and pit edge: ${lo} … ${hi} m`);
  // 0.10, not 0.20, and the change is the user's rather than mine. They asked
  // for "a bit of clearence on the curb side" and I answered it with 0.2175;
  // they have since asked to "make the dirt patch a lil bigger on the curb
  // side", which spends that strip down to 0.118. The strip is there so the
  // well does not crumble into the gutter and 12 cm still does that. A bar set
  // to defend my own earlier number would have failed the world for obeying the
  // newer instruction.
  console.log(`  ${lo > 0.10 ? 'OK  ' : 'FAIL'} every pit sits inboard with a real strip of walk at the kerb`);
  console.log(`  ${(hi - lo) < 0.002 ? 'OK  ' : 'FAIL'} that strip is the same at every pit`);
  // 0.10 HERE TOO. I lowered the printed verdict's bar to 0.10 for the user's
  // "a lil bigger on the curb side" and left this line on 0.2, so the check
  // printed every line OK and exited 1 — a verdict and its exit condition
  // disagreeing about the same number. That is the kerbcut vacuous-OK the other
  // way up: there the line lied and the exit was right, here the exit lies and
  // the lines are right. Both are one edit touching one of a pair.
  if (lo <= 0.10 || hi - lo >= 0.002) process.exitCode = 1;
}
// THE WATER GOES IN THE GUTTER, which was asked for in those words: "the puddle
// doesnt make sense here. the gutter should have the water in the gutter". It
// was built — ct/props.ts places pools at ROAD_HALF - 0.10 back to -0.32, inside
// a 0.45 m pan — and then nothing asserted it. The sheets were COUNTED on the
// line above and never questioned, so a pool out in the travel lane, or out on
// the walk, would have read as nine happy water sheets.
//
// The kerb-straddle test below does not cover this. A pool sitting entirely in
// the middle of the road straddles nothing.
// RH and GW are declared inside the page closure above, so they are restated
// here rather than reached for — the pits block does the same with 5.0625.
const RH_N = 5.0, GW_N = 0.45;
if (r.water.length) {
  const pan = r.water.map((w) => +(RH_N - Math.abs(w.x)).toFixed(3));   // 0 at the kerb, + into the road
  const worst = Math.max(...pan);
  const onWalk = r.water.filter((w) => Math.abs(w.x) > RH_N).length;
  console.log(`\n  standing water: ${r.water.length} sheets, ${Math.min(...pan)} … ${worst} m in from the kerb line`);
  console.log(`  ${worst <= GW_N ? 'OK  ' : 'FAIL'} every pool sits in the ${GW_N} m gutter pan, not out in the lane`);
  console.log(`  ${!onWalk ? 'OK  ' : 'FAIL'} none of it is up on the pavement (${onWalk})`);
  if (worst > GW_N || onWalk) process.exitCode = 1;
}

console.log(`\n  ${!r.crossers.length ? 'OK  ' : 'FAIL'} nothing straddles the kerb line (${r.crossers.length})`);
for (const c of r.crossers.slice(0, 8)) console.log(`      ${c.label} at z ${c.z}: x ${c.minX} … ${c.maxX} crosses ${c.line}`);
console.log(`  ${!r.sunk.length ? 'OK  ' : 'FAIL'} nothing sits below the ground under it (${r.sunk.length})`);
for (const s of r.sunk.slice(0, 8)) console.log(`      ${s.label} at z ${s.z}: y ${s.minY} under ground ${s.ground}`);
const clips = [...new Map((r.clips ?? []).map((c) => [`${c.kind}${c.x}${c.z}`, c])).values()];
console.log(`  ${!clips.length ? 'OK  ' : 'FAIL'} no litter is inside a building or a prop (${clips.length})`);
for (const c of clips.slice(0, 8)) console.log(`      ${c.kind} at ${c.x}, ${c.z}`);
if (r.crossers.length || r.sunk.length || clips.length) process.exitCode = 1;

await browser.close();
if (errors.length) { console.error('\nPAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('\nno page errors');
