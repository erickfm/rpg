// feat/building-depth + feat/flanks — is a building a building, or a stage flat?
//
// The complaint was *"every one is a 3.4 m box"*: every shell on the block was
// 3.4 m deep, so from any angle that showed a return you were looking at scenery
// rather than a building. `depthOf` now gives each one 14–23.5 m, varied per
// name.
//
// `9ca895b0`: guard the DEFECT, not the quality. The two halves of the
// complaint were **shallow** and **all the same**, so those are the two
// assertions, and neither is a restatement of `depthOf`:
//
//   1. no shell is shallower than 8 m — the rule is that below roughly a
//      room's depth a shell reads as a flat. 3.4 fails it; 8 would pass it,
//      which is deliberate. This is not "≥ 14" because 14 is `depthOf`'s own
//      floor, and asserting a constant against itself checks plumbing only.
//   2. at least four distinct depths — the other half of the complaint was
//      uniformity, and a world that made every shell 20 m deep would satisfy
//      (1) while reading exactly as wrong.
//
// HOW IT KNOWS WHICH DIMENSION IS DEPTH. It does not guess. `ct/street.ts`
// stamps `userData.facing` ('x' or 'z') on every shell it places, because a
// BoxGeometry carries world-axis width/depth and nothing that says which is
// the front. Inferring it from position misreads the alley's END WALL as a
// 1.2 m building and the bodega's side-street corner block as a 3.4 m one —
// I tried, and it is written up in notes/D-alley-report.md. Only real shells
// carry the stamp, which is also what keeps walls out without a list of
// exceptions.
//
//   SHOT_URL=http://localhost:PORT/ node scripts/shells.mjs [--selftest]
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld, integrationNoise } from './lib/which-world.mjs';
import { installMats } from './lib/materials.mjs';

// GOTCHAS §34 shape one: a flag that matches nothing must not pass silently.
// `--selftest` is the only argument these take, and `argv.includes` would let
// `--seltest` through — you would believe you had run the selftest, the normal
// check would run instead, and it would print a pass. Refuse what we do not
// understand rather than quietly doing something else.
for (const a of process.argv.slice(2)) {
  if (a !== '--selftest') {
    console.error(`unknown argument ${JSON.stringify(a)} — this script takes --selftest and nothing else`);
    process.exit(2);
  }
}
const SELFTEST = process.argv.includes('--selftest');
const URL = aim('http://localhost:4231/');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errors = [];
page.on('pageerror', (e) => {
  // integrationNoise() is the HMR socket in the live world and nothing else.
  if (integrationNoise(e.message)) return;
  errors.push('pageerror: ' + String(e.message));
});
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, URL);
await installMats(page);
await page.waitForTimeout(900);

const shells = await page.evaluate(() => {
  const s = window.__ct.scene();
  const out = [];
  // Reduce a texture to a hash of what it LOOKS like: 24x24 of its own pixels.
  // Not its uuid — see the note on the uniformity assertion below.
  // A COARSE descriptor, not an exact hash of the pixels: 24x24 reduced to 4x4
  // averaged blocks, so one-pixel noise cannot change it but a different wall
  // does.
  // PER CHANNEL, quantised at 8 — and both numbers are measured, not chosen.
  // Same wall across two page loads drifts at most 2.22/255 in a block mean
  // (that is the dither speckle, averaged over 36 px). The alley's two flanks,
  // which are deliberately different walls, differ by 20.17/255. A step of 8
  // sits 3.6x above the noise and 2.5x below the signal.
  //
  // My first version averaged R+G+B into one luminance and quantised at 32.
  // That absorbed the speckle and ALSO absorbed the alley flanks: #623f32 and
  // #563a2f both land in the same bucket, so a check that exists to prove two
  // walls are different reported one. Throwing away hue to beat noise threw
  // away the signal with it.
  //
  // The exact hash was blind, and this is the SECOND time this assertion has
  // been. It counted map.uuid first, which counted allocations; that was fixed
  // to hash pixels. But ct/paint.ts's dither() paints with UNSEEDED
  // Math.random(), so two walls painted from IDENTICAL parameters still differ
  // by speckle and still hash apart. Measured, mutating flankTex to paint every
  // return from one set of parameters:
  //
  //                       clean world   every flank identical
  //     exact pixel hash      19               19      <- blind
  //     mean colour           19                5
  //     coarse 4x4 blocks     15                4
  //
  // dc0f4e8b's comment claims that mutant "genuinely has 19 different-looking
  // returns and BOTH instruments are right to pass it". That was wrong. They
  // are the same brown with different dust on it, which is exactly the user's
  // complaint, and 2e7f51c0's note about dither and Math.random is what pointed
  // at it.
  const cv = document.createElement('canvas');
  cv.width = 24; cv.height = 24;
  const g = cv.getContext('2d', { willReadFrequently: true });
  const pixelHash = (tex) => {
    try {
      g.clearRect(0, 0, 24, 24);
      g.drawImage(tex.image, 0, 0, 24, 24);
      const d = g.getImageData(0, 0, 24, 24).data;
      const out = [];
      for (let by = 0; by < 4; by++) {
        for (let bx = 0; bx < 4; bx++) {
          let r = 0, gg = 0, bb = 0, n = 0;
          for (let y = by * 6; y < by * 6 + 6; y++) {
            for (let x = bx * 6; x < bx * 6 + 6; x++) {
              const i = (y * 24 + x) * 4;
              r += d[i]; gg += d[i + 1]; bb += d[i + 2]; n++;
            }
          }
          out.push(r / n, gg / n, bb / n);
        }
      }
      return out;
    } catch (e) { return null; }
  };
  s.traverse((o) => {
    if (!o.isMesh || !o.userData.facing) return;
    o.updateWorldMatrix(true, false);
    const g = o.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const at = new o.position.constructor();
    o.getWorldPosition(at);
    // BoxGeometry face order is [+x,-x,+y,-y,+z,-z]. A shell facing 'x' has its
    // facade on ±x, so its FLANKS — the returns the complaint was about — are
    // the ±z faces, and vice versa.
    // window.__mats, not `Array.isArray(o.material) ? ... : [...]` written out
    // again — this exact line is the one four checks got wrong this week, and
    // it is measurably 51% of the world. See scripts/lib/materials.mjs.
    const ms = window.__mats(o);
    const flanks = (o.userData.facing === 'x' ? [4, 5] : [0, 1]).map((i) => ms[i]).filter(Boolean);
    out.push({
      depth: +(o.userData.facing === 'x' ? bb.max.x - bb.min.x : bb.max.z - bb.min.z).toFixed(2),
      facing: o.userData.facing,
      at: [+at.x.toFixed(1), +at.z.toFixed(1)],
      flanksUntextured: flanks.filter((m) => !m.map).length,
      mats: ms.filter((m) => m && m.color).length,
      graded: ms.filter((m) => m && m.color && m.userData && m.userData.graded).length,
      // The PIXELS, not the object identity. See the note below.
      flankMaps: flanks.filter((m) => m.map).map((m) => pixelHash(m.map)),
    });
  });
  return out;
});

// "How many DIFFERENT walls" is a distance question, not an equality one.
// Quantising the descriptor did not make it robust, it only moved the
// sensitivity to the bucket edges: with 48 numbers per wall, something always
// lands near a boundary and flips on 2 units of speckle. Measured, the mutant
// that paints every return from identical parameters still read 17 of 36.
//
// So walls are grouped by DISTANCE, and the threshold comes from the measured
// distribution rather than from taste. All 630 pairs among the 36 faces:
//
//     0.0   x17     <- the two faces of one shell, which share a material
//     (nothing at all between 0 and 6)
//     6:12  7:12  8:12  9:16  10:16  11:8  12:24  13:16  14:20 ...
//
// and the same wall re-read across two page loads drifts at most 2.22/255.
// So the gap is [2.22, 6.0] and the threshold belongs in the middle of it.
//
// I first put it at 6, which is the EDGE of the first populated bucket, and the
// count flipped 19/18 between runs because a dozen pairs sit right there and
// speckle drift pushes them across. A threshold on the lip of a cluster is not
// a threshold. 4 is 1.8 above the noise and 2.0 below the nearest real
// difference.
const SAME = 4;
const countWalls = (descs) => {
  const reps = [];
  for (const d of descs) {
    if (!d) continue;
    const near = reps.some((r) => {
      let mx = 0;
      for (let i = 0; i < d.length; i++) mx = Math.max(mx, Math.abs(d[i] - r[i]));
      return mx < SAME;
    });
    if (!near) reps.push(d);
  }
  return reps.length;
};

let fails = 0;
const say = (ok, name, detail) => {
  if (!ok) fails++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}: ${detail}`);
};

const depths = shells.map((s) => s.depth).sort((a, b) => a - b);
const distinct = new Set(depths).size;
const shallow = shells.filter((s) => s.depth < 8);

say(shells.length >= 15, 'the block still has its shells',
  `${shells.length} carry a facing stamp`);
say(shallow.length === 0, 'no building is a stage flat',
  shallow.length
    ? `${shallow.length} under 8 m: ` + shallow.map((s) => `${s.depth} m at ${s.at}`).join(', ')
    : `shallowest is ${depths[0]} m`);
say(distinct >= 4, 'they are not all the same building',
  `${distinct} distinct depths, ${depths[0]}–${depths[depths.length - 1]} m`);

// ── the second complaint about the same objects ────────────────────────────
//
// "the FRONT is a pale precast panel system with a regular window grid, the
// RETURN is full red brick with NO WINDOWS AT ALL … it is not the wrong shade,
// it is a different building." Raised twice. The cause was `endM`: ONE flat
// colour, no texture at all, shared by every shell's returns.
//
// Both halves of that are structural and neither is a judgement about how the
// brick looks: a return had no map, and every return had the SAME no-map.
//
// THE UNIFORMITY ASSERTION COUNTS PIXELS, AND USED TO COUNT UUIDs. A set of
// `map.uuid` counts ALLOCATIONS, not appearances, and `partyWallTex` builds a
// fresh canvas on every call — so 36 returns make 36 objects whatever they
// look like. The complaint was about how they LOOK. It now hashes 24x24 of
// each texture's own pixels.
//
// Demonstrated, not assumed. Mutate `flankTex` to paint one texture and hand
// out `.clone()` of it — every return the same image, each with its own uuid,
// which is the user's "every flank is the same brown" exactly:
//
//     uuid instrument    19 distinct across 36 faces   PASS  <- blind
//     pixel hash          3 distinct across 36 faces   FAIL
//
// (The 3 are other painters — the bank return and the open sites' exposed
// party walls — which is why the threshold is not 1.)
//
// TWO MUTANTS BEFORE THAT ONE WERE INVALID, and both looked like a passing
// guard. Replacing `flankTex`'s body with a constant call does NOT make the
// returns identical: `partyWallTex` varies per call beyond its `salt`, so that
// world genuinely has 19 different-looking returns and BOTH instruments are
// right to pass it. I read its green as proof of a hole, which it was not —
// the hole is real but only the clone mutant shows it. I had also grepped the
// run down to PASS/FAIL lines and thrown away reportWorld's build banner,
// which is the stale-bundle trap in GOTCHAS 26, in a check I wrote.
//
// The general point is bf820319's: a selftest that inverts an assertion proves
// the script reads the world; only a mutation of the SOURCE proves the guard
// would catch the regression. And a mutant that does not actually reintroduce
// the defect proves nothing in either direction — check the mutant is the bug
// before you believe what the guard says about it.
const untextured = shells.reduce((n, s) => n + s.flanksUntextured, 0);
const flankWalls = countWalls(shells.flatMap((s) => s.flankMaps));
say(untextured === 0, 'no return is a flat colour',
  untextured ? `${untextured} flank faces carry no texture` : `${shells.length * 2} flanks, all textured`);
// DERIVED FROM THE POPULATION, not a fixed 12. GOTCHAS §34 the other way up
// (cd959c8d1): a threshold that makes a correct world fail. I flagged this one
// myself in the stopwatch sweep as the number I would not defend — "a builder
// who legitimately reduced variety to eleven gets a red that says nothing" —
// because 12 was chosen against a block that happens to have 18 shells.
//
// What the assertion means is "most buildings wear their own wall", so it scales
// with how many buildings there are. 18 shells today puts the bar at 14 and the
// world reads 19; a block half the size would put it at 7 rather than failing on
// a number that outlived its block.
const wallBar = Math.max(3, Math.floor(shells.length * 0.8));
say(flankWalls >= wallBar, 'returns are not one shared material',
  `${flankWalls} distinct walls across ${shells.length * 2} faces `
  + `(bar ${wallBar} = 80% of ${shells.length} shells)`);
// ── does the block go dark? ────────────────────────────────────────────────
//
// a7f2241d found `nightgrade`'s collector doing `if (Array.isArray(m)) return`,
// so every multi-material mesh was invisible to it — and a six-material box is
// exactly how these shells are built. That was a hole in a CHECK. This asserts
// the same thing about the WORLD: props.ts:register must actually be offered
// every face of every shell, or the buildings stop losing the light at night
// while everything around them loses it.
//
// It reads `userData.graded`, which props.ts stamps precisely so that "was
// handed to the dimmer and did not move" is decidable from outside.
//
// Watched failing on two mutants, both of which had to be checked for actually
// being the bug first:
//
//   dimWorld skips arrays (a7f2241d's bug, in the world)   0 of 108   FAIL
//   flank materials go transparent, so isGlass skips them  82 of 108  FAIL
//
// A third mutant — setting `userData.noLight` on the flanks — does NOT fire,
// and that is a fact about props.ts rather than a hole here. `noLight` is
// honoured by `register()`, the lamp-pool path for chrome and glass and rubber
// out of ct/cars.ts. `dimWorld()`, which is what grades these shells, never
// looks at it. 26 materials came back carrying `noLight` AND `graded`
// together. Written up for B in notes/D-alley-report.md; nothing here depends
// on it.
const mats = shells.reduce((n, s) => n + s.mats, 0);
const graded = shells.reduce((n, s) => n + s.graded, 0);
say(mats > 0 && graded === mats, 'every shell face is offered to the dimmer',
  `${graded} of ${mats} shell materials carry userData.graded`);

say(errors.length === 0, 'no page errors', errors.length ? errors[0] : 'none');

if (SELFTEST) {
  // Assert the DEFECT — that the block is full of 3.4 m flats — and require it
  // to fail. If it passes, this is reading something other than the world.
  console.log('\nselftest — asserting the original defect, which must FAIL');
  const before = fails;
  say(shells.filter((s) => s.depth < 8).length > 5, 'the block is 3.4 m flats (the bug)',
    `${shallow.length} shells under 8 m`);
  say(distinct <= 1, 'every shell is the same depth (the bug)', `${distinct} distinct`);
  say(untextured > 10, 'the returns are flat colour (the bug)', `${untextured} untextured`);
  say(flankWalls <= 1, 'every return shares one material (the bug)', `${flankWalls} distinct`);
  say(graded === 0, 'the block never darkens (the bug)', `${graded} of ${mats} graded`);
  const caught = fails - before;
  console.log(caught === 5
    ? '\nSELFTEST PASSED — all five inverted assertions were caught'
    : `\nSELFTEST FAILED — only ${caught} of 5 caught`);
  await browser.close();
  process.exit(caught === 5 ? 0 : 1);
}

await browser.close();
console.log(fails ? `\n${fails} FAILURES` : '\nthe block is built, not flatted');
process.exit(fails ? 1 : 0);
