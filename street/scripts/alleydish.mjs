// Does the alley floor you WALK match the alley floor you SEE?
//
// The user asked for a drain the alley falls toward: "the paving should dish
// slightly into it". That request is two changes, not one, and the first draft
// of it did only the visible half — `177b0e332` records why I stopped rather
// than shipping it. GOTCHAS §7: walking height comes from the PICKER, not from
// the mesh. Displace the geometry alone and the player strides flat across a
// visible bowl, which looks finished from every screenshot anyone would take.
//
// So this check does not ask "is there a dip". It asks whether the two halves
// AGREE, and it gets both from the world rather than from a formula:
//
//   what you SEE   the alley floor mesh's own displaced vertices
//   what you WALK  window.__ct.pos()[3], the ground picker's answer, read by
//                  actually standing the player at that vertex
//
// Deliberately NO mirror of dishAt() here. A test that recomputes the shape it
// is testing agrees with itself by construction and would pass just as happily
// if only the mesh moved — which is precisely the defect it exists to catch.
//
// GOTCHAS §34 — the population guard. "Every sampled vertex agrees" is
// vacuously true of zero vertices, and a mesh with no dish would satisfy it
// perfectly. So: the bowl must be found, it must be ~6 cm deep, and the flat
// rim must still read flat.
//
//   SHOT_URL=http://localhost:PORT/ node scripts/alleydish.mjs [--selftest]
import { chromium } from 'playwright';
import { reportWorld, integrationNoise } from './lib/which-world.mjs';

for (const a of process.argv.slice(2)) {
  if (a !== '--selftest') {
    console.error(`unknown argument ${JSON.stringify(a)} — this script takes --selftest and nothing else`);
    process.exit(2);
  }
}
const SELFTEST = process.argv.includes('--selftest');
const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errors = [];
page.on('pageerror', (e) => { if (!integrationNoise(e.message)) errors.push('pageerror: ' + e.message); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, URL);

// The mesh's own vertices, in world space, straight off the geometry.
const mesh = await page.evaluate(() => {
  let f = null;
  window.__ct.scene().traverse((o) => { if (o.userData?.alley === 'floor') f = o; });
  if (!f) return null;
  const pos = f.geometry.attributes.position;
  const V = new f.position.constructor();
  const out = [];
  for (let i = 0; i < pos.count; i++) {
    V.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    f.localToWorld(V);
    out.push([+V.x.toFixed(4), +V.y.toFixed(4), +V.z.toFixed(4)]);
  }
  return { verts: out, baseY: f.position.y };
});

let fails = 0;
const say = (ok, name, detail) => { if (!ok) fails++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}: ${detail}`); };

if (!mesh) {
  say(false, 'the alley floor exists', 'no mesh carrying userData.alley = "floor"');
  await browser.close();
  process.exit(1);
}

// The bowl, found from the mesh rather than assumed: lowest vertex, and how far
// it sits below the mesh's flat plane.
const flatY = mesh.baseY;
let lowest = mesh.verts[0];
for (const v of mesh.verts) if (v[1] < lowest[1]) lowest = v;
const depth = +(flatY - lowest[1]).toFixed(4);
const dished = mesh.verts.filter((v) => flatY - v[1] > 0.002);

say(dished.length > 8, 'the paving is actually dished, not flat',
  `${dished.length} of ${mesh.verts.length} vertices sit below the flat plane`);
say(depth > 0.035 && depth < 0.12, 'the fall is a drain, not a crater or a rumour',
  `${(depth * 100).toFixed(1)} cm at its deepest, world (${lowest[0].toFixed(2)}, ${lowest[2].toFixed(2)})`);

// Stand the player on chosen vertices and ask what the floor says. Sample the
// deepest, the rim, and a spread between, so a picker that answered a constant
// would be caught rather than averaged.
const byDepth = [...mesh.verts].sort((a, b) => a[1] - b[1]);
const picks = [
  byDepth[0],
  byDepth[Math.floor(dished.length * 0.15)],
  byDepth[Math.floor(dished.length * 0.4)],
  byDepth[Math.floor(dished.length * 0.75)],
  byDepth[Math.max(0, dished.length - 1)],
];
// THE FIRST WARP OF A PAGE DOES NOT SETTLE, and this cost me two false reds.
// `warp(x, z, yaw, gy, pitch)` calls setGy with the gy you pass, and the picker
// only refreshes on a later update — so the very first sample reads back the
// forced value rather than the floor. The same vertex read 0.0 cm on the first
// visit and −6.0 cm on a later one. D-walk.mjs documents the same warm-up
// ("one throwaway warp and a settle is enough to make attempt 1 behave like the
// rest") and I wrote this script without it.
await page.evaluate(() => window.__ct.warp(-9.0, -40.0, 0, 0, 0));
await page.waitForTimeout(400);

// AND THE PLAYER MUST ACTUALLY BE THERE. A warp puts the rig at (x, z) but the
// world may push it straight back out — the dumpster's collider covers
// x −12.5…−9.9, z −38.75…−37.55, and a sample inside it silently reads the
// floor 30 cm away instead. Verified rather than assumed: if the player did not
// land where it was sent, that vertex is not a fair sample and is skipped.
const stand = async (x, z) => {
  await page.evaluate(([a, c]) => window.__ct.warp(a, c, 0, 0, 0), [x, z]);
  await page.waitForTimeout(260);
  const p = await page.evaluate(() => window.__ct.pos());
  return { gy: p[3], off: Math.hypot(p[0] - x, p[2] - z) };
};

const rows = [];
let worst = 0, sampled = 0, skipped = 0;
for (const v of picks) {
  const { gy, off } = await stand(v[0], v[2]);
  if (off > 0.05) {
    skipped++;
    rows.push(`(${v[0].toFixed(2)}, ${v[2].toFixed(2)})  SKIPPED — a collider pushed the player ${(off * 100).toFixed(0)} cm off it`);
    continue;
  }
  sampled++;
  const seen = v[1] - flatY;                 // metres below the flat plane, from the MESH
  const err = Math.abs(gy - seen);
  if (err > worst) worst = err;
  rows.push(`(${v[0].toFixed(2)}, ${v[2].toFixed(2)})  seen ${(seen * 100).toFixed(1)} cm  walked ${(gy * 100).toFixed(1)} cm  Δ ${(err * 1000).toFixed(1)} mm`);
}
console.log('    ' + rows.join('\n    '));
// §34 again: "worst disagreement" over zero usable samples is 0, which passes.
say(sampled >= 3, 'enough of the bowl is reachable to judge it',
  `${sampled} sampled, ${skipped} skipped as unreachable`);
say(sampled >= 3 && worst < 0.012, 'the floor you walk is the floor you see',
  `worst disagreement ${(worst * 1000).toFixed(1)} mm across ${sampled} points`);

// Nothing OUTSIDE the bowl changed hands. groundPick's fallback gives KERB_H
// for |x| < FACE + 0.3 and 0 beyond it, so there is a 14 cm kerb step in the
// strip x −7.3 … −7.0 at the alley mouth. A registration that answered for the
// whole alley floor would silently flatten it, and nothing else would notice.
const kerb = (await stand(-7.15, -40.0)).gy;
say(Math.abs(kerb - 0.14) < 0.01, 'the kerb step at the alley mouth still stands',
  `x −7.15 reads ${(kerb * 100).toFixed(1)} cm (KERB_H is 14 cm)`);
const outside = (await stand(-13.2, -38.0)).gy;
say(Math.abs(outside) < 0.005, 'alley paving outside the bowl is still flat',
  `x −13.2 reads ${(outside * 100).toFixed(2)} cm`);

// Walk it, rather than teleporting onto it. GOTCHAS: floors are verified by
// walking. A picker can be right at every sampled point and still deliver a
// step, because warping never crosses the ground between two places.
// yaw 0 walks toward −z, DEEPER into the alley. Facing π walks back out onto
// the sidewalk, where the floor is KERB_H — my first draft did exactly that and
// reported the alley's "deepest" point as +14 cm, which is the kerb, not a
// floor. Start south of the dumpster (its collider ends at z −38.75) so the
// walk crosses the drain at z −40.77 in open floor.
await page.evaluate(() => window.__ct.warp(-10.3, -39.2, 0, 0, 0));
await page.waitForTimeout(340);
const track = [];
for (let i = 0; i < 14; i++) {
  await page.keyboard.down('w'); await page.waitForTimeout(150);
  await page.keyboard.up('w'); await page.waitForTimeout(80);
  const p = await page.evaluate(() => window.__ct.pos());
  track.push([+p[2].toFixed(2), +p[3].toFixed(4)]);
}
let jump = 0, jumpAt = null;
for (let i = 1; i < track.length; i++) {
  const d = Math.abs(track[i][1] - track[i - 1][1]);
  if (d > jump) { jump = d; jumpAt = track[i][0]; }
}
const walkedDepth = Math.max(...track.map((t) => -t[1]));
console.log(`    walked z ${track[0][0]} → ${track[track.length - 1][0]}, deepest ${(walkedDepth * 100).toFixed(1)} cm`);
say(walkedDepth > 0.02, 'walking into the alley actually takes you down',
  `${(walkedDepth * 100).toFixed(1)} cm below the flat floor at the lowest point of the walk`);
say(jump < 0.025, 'no step: the fall is continuous under the feet',
  `largest change between consecutive samples ${(jump * 1000).toFixed(1)} mm${jumpAt !== null ? ` near z ${jumpAt}` : ''}`);
// THE CASTING, which is B's floorDrain() rather than a second grate design.
// Scoped to the alley drain by position — basin.mjs owns the two kerb inlets
// and finds them the same way, so neither check can see the other's castings.
const cast = await page.evaluate(([dx, dz]) => {
  const parts = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.userData?.basinPart) return;
    if (Math.hypot(o.position.x - dx, o.position.z - dz) > 1.5) return;
    const g = o.geometry?.parameters ?? {};
    parts.push({ part: o.userData.basinPart, y: +o.position.y.toFixed(4),
      top: g.height ? +(o.position.y + g.height / 2).toFixed(4) : null });
  });
  const tops = (n) => parts.filter((q) => q.part === n).map((q) => q.top).filter((v) => v !== null);
  const f = tops('frame'), b = tops('bar');
  return { n: parts.length, frameTop: f.length ? Math.max(...f) : null,
    barTop: b.length ? Math.max(...b) : null, bars: b.length };
}, [-10.30, -40.77]);

say(cast.n >= 12 && cast.bars >= 5, 'the drain is casting, not four painted lines',
  `${cast.n} solids near the drain, ${cast.bars} bars`);
// The whole read, and B's own reason for the geometry: a flush grate looks
// painted on. Bars sunk under the frame top is what makes it a HOLE.
const rebate = cast.frameTop !== null && cast.barTop !== null ? cast.frameTop - cast.barTop : 0;
say(rebate > 0.005, 'the bars are sunk under the frame, so it reads as a hole',
  `rebate ${(rebate * 1000).toFixed(1)} mm`);
// INTEGRATION, not the casting's own property: it must sit at the BOTTOM OF THE
// BOWL. floorDrain takes the floor height from its caller and does not guess,
// so passing the flat alley height would have left the frame floating 60 mm
// over the dip it is supposed to sit in — and from directly above, which is how
// anyone would screenshot it, that looks identical to correct.
say(cast.frameTop !== null && cast.frameTop < -0.02,
  'the casting sits at the bottom of the dish, not at the flat floor',
  cast.frameTop === null ? 'no frame found'
    : `frame top ${cast.frameTop.toFixed(4)} m; flat placement would put it near +0.029`);

say(errors.length === 0, 'no page errors', errors.length ? errors[0] : 'none');

if (SELFTEST) {
  // Invert the two assertions that carry the check. The agreement test is the
  // point of the script, and the population test is what stops a flat world
  // passing it vacuously — inverting only one leaves the other unwatched, which
  // is the hole 419e0a20c found in midnight's selftest.
  console.log('\nselftest — asserting the defects, which must FAIL');
  const before = fails;
  say(worst >= 0.012, 'the walked floor disagrees with the drawn floor (the bug)',
    `worst ${(worst * 1000).toFixed(1)} mm`);
  say(dished.length <= 8, 'the paving is flat, so there is nothing to disagree about (the bug)',
    `${dished.length} dished vertices`);
  const caught = fails - before;
  console.log(caught === 2
    ? '\nSELFTEST PASSED — both inverted assertions were caught'
    : `\nSELFTEST FAILED — only ${caught} of 2 caught, so this measures less than it claims`);
  await browser.close();
  process.exit(caught === 2 ? 0 : 1);
}

await browser.close();
console.log(fails ? `\n${fails} FAILURES` : '\nthe alley falls to its drain, and you fall with it');
process.exit(fails ? 1 : 0);
