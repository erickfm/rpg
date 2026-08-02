// feat/wet — the street remembers the weather, and standing water stays DARK.
//
// Renamed from wet.mjs. That name collided with another builder's script on the
// same subject and on a rebase mine lost — the SECOND time this session after
// curbcut.mjs. A script that is gone does not fail. It stops being run, and
// nothing says so.
//
// What went missing mattered: the last assertion here is the contract that
// standing water is darker than the road AT EVERY HOUR, which guards a feature
// the user rejected four times for being invisible or inverted. A mutation
// proved the hole — I set the puddle body LIGHTER than the road, the exact
// original bug, and the suite stayed green.
//
// Theirs asks whether the decay curve is real, which mine does not. Both are
// worth having; they just cannot share a filename.
//
// Everything here is TIMING, so none of it can be shown in a still. The probe
// drives the clock from a rainy hour to a dry one and samples what happens
// after the last drop lands.
//
// Usage: SHOT_URL=http://localhost:4279/ node scripts/wet.mjs [probe|shots|all]
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { goto } from './lib/reachable.mjs';
import { modes } from './lib/modes.mjs';

const mode = modes('wetness', ['probe', 'shots'], 'probe');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await goto(page, aim('http://localhost:4177/'));
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(page, aim('http://localhost:4177/'));   // GOTCHAS 26: prove it, do not just name it

// CPU_THROTTLE=20 is how the SLEPT was finally reproduced on purpose. canfail
// runs this under a full `npm run build` and a browser per case, and the whole
// defect only exists when frames are slow — an idle box catches the mutation
// every time and tells you nothing. Applied after load so the world still boots.
const THROTTLE = Number(process.env.CPU_THROTTLE ?? 1);
if (THROTTLE > 1) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  console.log(`CPU throttled x${THROTTLE}`);
}
await page.waitForTimeout(500);

// same predicate ct/props.ts uses, so we pick hours the world agrees are wet
// The world's rain predicate, duplicated here because scripts cannot import
// from the TS module. It has an EXCEPTION now — 14:00 always rains, to put
// the first storm 40 s from spawn — so a script that picks "the first dry
// hour" must know about it or it will pick a wet one. Keep in step with
// rainAt() in ct/props.ts.
// THE SCHEDULE, ASKED OF THE WORLD. This file used to hand-copy rainAt's
// formula with a comment saying "keep in step with ct/props.ts" — and then that
// formula turned out to be a lattice (cd37b59b) and was replaced. Two copies of
// a wrong thing is two places to forget. props publishes the real function on
// scene.userData now, so this reads the schedule instead of reproducing it.
const SCHEDULE = await page.evaluate(() => {
  const f = window.__ct.scene().userData.rainAt;
  if (typeof f !== 'function') return null;
  return Array.from({ length: 240 }, (_, h) => !!f(h));
});
if (!SCHEDULE) { console.error('\n  FAIL props did not publish scene.userData.rainAt — cannot pick hours'); process.exit(1); }
const rainyFromWorld = (h) => SCHEDULE[((h % 240) + 240) % 240];
const rainy = (h) => rainyFromWorld(h);   // asked, not mirrored — see below
let wetH = -1, dryH = -1;
for (let h = 0; h < 48; h++) { if (wetH < 0 && rainy(h)) wetH = h; if (dryH < 0 && !rainy(h)) dryH = h; }

/** Wait for `n` RENDERED frames. Every wait that measures DRYING goes through
 *  here — see the block above the sample ladder for why milliseconds are the
 *  wrong unit for this file. */
const waitFrames = (n) => page.evaluate((n) => new Promise((resolve) => {
  let seen = 0;
  const tick = () => (++seen >= n ? resolve() : requestAnimationFrame(tick));
  requestAnimationFrame(tick);
}), n);

const read = () => page.evaluate(() => {
  const sc = window.__ct.scene();
  // `wetness` is the world's own published state — ct/props.ts:1010, "how wet
  // the GROUND is; lags rain". Every surface colour below is computed from it,
  // so reading it names the quantity the verdicts are actually about instead of
  // inferring it from two hex strings.
  const out = { pud: [], refl: [], strip: null, broad: null, rainOpacity: 0,
                wetness: +(sc.userData.wetness ?? -1).toFixed(4) };
  sc.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const m = o.material;
    // Puddle sheets come in two shapes now — 48x32 discs on the road crown
    // and 16x64 RUNS in the gutter pan, since water in a gutter is a ribbon —
    // and each one carries a second additive sheet on top of it, the
    // reflection. Split them by blending: the body is NormalBlending (1), the
    // reflection is AdditiveBlending (2). Reading them together was measuring
    // a mixture of the two and reporting nonsense.
    const im = m.map?.image;
    // 48x32 was the standing puddle and no longer exists (desk ruling,
    // 2026-07-25). Only the 16x64 gutter stain is left on this path.
    const sheet = im && im.width === 16 && im.height === 64;
    if (sheet && m.transparent) {
      (m.blending === 2 ? out.refl : out.pud).push(+m.opacity.toFixed(4));
      return;
    }
    if (!m.map?.image || m.transparent) return;
    const img = m.map.image;
    // the wet registry: long thin strips are kerb/gutter, broad sheets are
    // road and walk
    if (img.height < 32 && img.width > 200 && !out.strip) out.strip = m.color.getHexString();
    if (img.width === 64 && img.height === 64 && !out.broad) out.broad = m.color.getHexString();
  });
  const pts = sc.children.find((c) => c.isPoints);
  out.rainOpacity = pts ? +pts.material.opacity.toFixed(3) : 0;
  out.raining = pts ? pts.visible : false;
  return out;
});

if (mode === 'probe' || mode === 'all') {
  console.log(`\nrainy hour ${wetH}, dry hour ${dryH}`);
  // STAND OUTSIDE FIRST. ct/props.ts cuts the weather when the player is
  // indoors — `if (px > 100) rainLevel = 0; // it NEVER rains indoors` — and
  // the spawn is now room 301 at x 198.6, so a check that never moves measures
  // the weather from inside a building and sees none of it.
  //
  // This check used to pass because the spawn used to be on the street. Nothing
  // about the rain changed; the world moved out from under a script that
  // assumed where it woke up. I spent most of a round concluding "it never rains
  // any more" off exactly that, with rainLevel 0 at all seven rainy hours and a
  // natural clock crossing to confirm it, before warping outdoors and watching
  // it ramp to 0.999 in four seconds.
  await page.evaluate(() => window.__ct.warp(6.2, -50, 0, 0.14, 0));
  await page.waitForTimeout(300);
  await page.evaluate((h) => window.__ct.clock(h, 0), wetH);
  await page.waitForTimeout(5000);                       // let it come down
  const wet = await read();
  const rainingNow = wet.rainOpacity;
  console.log(`  during the storm: rain opacity ${rainingNow}, ` +
    `puddles ${wet.pud.filter((o) => o > 0.02).length}/${wet.pud.length} showing`);

  // ── the ladder is counted in FRAMES, and that is the whole fix ─────────────
  //
  // This used to be seven waits of 2000 ms, and it made `wetness` the one guard
  // in canfail.mjs that SLEPT — non-deterministically, CAUGHT/CAUGHT/SLEPT/
  // SLEPT/CAUGHT across five identical invocations, which a previous pass
  // recorded but could not explain.
  //
  // The explanation is `dt`, clamped at 0.05 s in src/main.ts:107. Drying is
  // `wetness -= dt / dryFor` per frame (ct/props.ts:1925), so the street dries
  // in SIMULATED time, and under load a wall-clock second buys far less than a
  // second of it. canfail runs a full `npm run build` and a browser per case,
  // so its runs are exactly the loaded ones: the same 14 s ladder that reaches
  // a bone-dry street on an idle box stops short of it under load, every
  // verdict passes, and the guard reports itself healthy against a world whose
  // drying rate has been scaled by 200x.
  //
  // Frames are not a perfect clock either — one frame is between ~1/60 s and
  // the 0.05 s clamp, so the time base is uncertain by about 3x. It does not
  // need to be better than that: the mutation this must catch changes the rate
  // by 200x, so a 3x band leaves nearly two orders of magnitude of margin, and
  // unlike milliseconds it cannot be truncated to nothing.
  const LADDER_FRAMES = 60;                 // per rung, 7 rungs
  await page.evaluate((h) => window.__ct.clock(h, 0), dryH);
  const samples = [];
  for (let i = 0; i < 7; i++) {
    await waitFrames(LADDER_FRAMES);
    const r = await read();
    samples.push(r);
    const maxP = Math.max(...r.pud);
    console.log(`  +${((i + 1) * LADDER_FRAMES).toString().padStart(3)} frames after the rain stops: ` +
      `rain ${r.rainOpacity.toFixed(3)}  wetness ${r.wetness.toFixed(4)}  darkest stain ${maxP.toFixed(3)}  ` +
      `road ${r.broad}  gutter ${r.strip}`);
  }

  // the drop volume fades over ~6 s and its opacity asymptotes rather than
  // hitting zero, so ask whether it is still being DRAWN, at the end
  const rainStopped = !samples[samples.length - 1].raining;
  const maxAt = samples.map((s) => Math.max(...s.pud));
  // Puddles must still be FILLING after the rain has gone. Measured on the
  // MEAN rather than the max: the gutter ribbons start collecting almost at
  // once and pin at 1.0 within a couple of seconds, so a max-based test can
  // only ever report "not rising" once any one puddle has saturated. The
  // claim is about the population — the deep low spots are still finding
  // water minutes after the last drop — and the mean is what states it.
  const meanAt = samples.map((s) => s.pud.reduce((a2, b2) => a2 + b2, 0) / s.pud.length);
  const stillFilling = meanAt[3] > meanAt[0] + 0.005;
  // ── "not bone dry on the last drop", which this verdict did not say ────────
  //
  // It used to be `last.broad !== wet.broad || last.strip !== wet.strip` — the
  // surfaces at the end of the window differ from the surfaces during the
  // storm. That is a test for the street having CHANGED, and a street that
  // flashes bone dry the instant the rain stops changes more than one that
  // stays wet. I watched it pass, three times, on a world drying 200x too
  // fast, printing `road 3c3c3c gutter 3c3c3c` — the ungraded base colour —
  // under the words "the street is still wet". A verdict that its own failure
  // mode satisfies is the sleeping guard this item is about; it happened to sit
  // inside the guard rather than beside it.
  //
  // What it should say is the user's request: "make wetness last a lil after it
  // stops". So state it about the world's own `wetness`, over a bound DERIVED
  // from the drying law rather than picked. Drying is
  // `wetness -= dt / dryFor` (ct/props.ts:1925) with `dt` capped at DT_CLAMP
  // (src/main.ts:107) and `dryFor` at its FASTEST when soak and night are both
  // zero, i.e. DRY_FOR_MIN (ct/props.ts:1924). So over a window of N frames no
  // healthy world can shed more than N * DT_CLAMP / DRY_FOR_MIN, whatever the
  // frame rate. Measured here: the real world sheds ~0.13 against a 0.44 bound,
  // and the mutated one sheds everything.
  //
  // COPIED, not imported, with citations — neither is exported (BUILDER-BRIEF
  // §8). Same follow-up as scripts/jump-walk.mjs: hoist them.
  const DT_CLAMP = 0.05;       // src/main.ts:107          Math.min(clock.getDelta(), 0.05)
  const DRY_FOR_MIN = 48;      // src/proto/ct/props.ts:1924   dryFor = 48 * (1+soak*1.5) * (1+nightNow*1.1)
  const maxDrop = (7 * LADDER_FRAMES) * DT_CLAMP / DRY_FOR_MIN;
  const wetnessAt = samples.map((s) => s.wetness);
  const dropped = wetnessAt[0] - wetnessAt[wetnessAt.length - 1];
  const streetStillWet = wetnessAt[wetnessAt.length - 1] >= 0 && dropped <= maxDrop;
  const stillDark = maxAt[maxAt.length - 1] > 0.05;
  // individual fill: they must not move in lockstep
  const spread = new Set(samples[3].pud.filter((o) => o > 0.02).map((o) => o.toFixed(3)));
  const individual = spread.size >= 3;
  // AND THE POPULATION ITSELF, explicitly. `individual` is a floor by accident
  // — three distinct depths cannot happen with fewer than three pools — so this
  // check was already safe against ZERO. It was not safe against a COLLAPSE:
  // nine pools falling to three passes every verdict here.
  //
  // Watched, not reasoned. Retexturing the puddle sheet 48x32 -> 48x34 leaves
  // the puddles in the street and hides them from the predicate at the top of
  // this file; the population fell 9 -> 2 and this file went red on
  // `stillFilling`, which is the right outcome for the WRONG reason — the two
  // survivors happened to saturate. Had they not, 2 of 9 would have passed
  // three of the six verdicts.
  //
  // THE POOL FLOOR IS GONE WITH THE POOLS. It read "at least 7 pools to
  // measure" and the correct number is now zero: the desk removed standing
  // water on 2026-07-25 after five passes. Everything below that depended on
  // puddle PHYSICS — crest-late, individual depths, darker-than-the-road —
  // went with it, because a verdict about water that does not exist is worse
  // than no verdict. footprint.mjs asserts the removal itself, with a
  // mutation that re-adds one.
  //
  // What survives here is what the desk kept and the user likes: the rain
  // stops, the street stays wet after it, and the gutter dries slower than
  // the crown. Those are measured on the SURFACES, which is where the wet
  // look always actually lived.
  const enough = true;
  // the gutter holds water longer than the road crown
  const gutterHolds = samples[3].strip !== samples[3].broad;

  console.log(`\n  ${rainStopped ? 'OK  ' : 'FAIL'} the rain actually stopped`);
  console.log(`  ${streetStillWet ? 'OK  ' : 'FAIL'} the street is still wet, not bone dry on the last drop` +
    ` (wetness ${wetnessAt[0].toFixed(4)} -> ${wetnessAt[wetnessAt.length - 1].toFixed(4)}, shed ${dropped.toFixed(4)} of at most ${maxDrop.toFixed(4)})`);
  console.log(`  ${gutterHolds ? 'OK  ' : 'FAIL'} the gutter and the road crown dry at different rates`);

  // The puddle-versus-road contrast block stood here. It was the sharpest
  // thing in this file — it caught the inversion that four passes had missed —
  // and it is retired only because its subject is gone. The lesson it proved is
  // recorded in ct/props.ts where the meshes used to be: anything laid on the
  // road must be defined RELATIVE to the road's current colour, never as a
  // fixed dark, or the wet tint overtakes it and the contrast inverts.

  if (!enough || !rainStopped || !streetStillWet || !gutterHolds) process.exit(1);
}

if (mode === 'shots' || mode === 'all') {
  const shot = async (n, x, z, tx, tz, gy = 0, p = 0) => {
    await page.evaluate(([x, z, tx, tz, gy, p]) =>
      window.__ct.warp(x, z, Math.atan2(tx - x, -(tz - z)), gy, p), [x, z, tx, tz, gy, p]);
    await page.waitForTimeout(320);
    await page.screenshot({ path: `shots/wt-${n}.png` });
  };
  await page.evaluate((h) => window.__ct.clock(h, 0), wetH);
  await page.waitForTimeout(6000);
  await shot('storm-road', -1.0, -14, -1.0, -44, 0, -0.10);
  await shot('storm-gutter', 3.6, -30, 4.8, -40, 0, -0.30);
  await page.evaluate((h) => window.__ct.clock(h, 0), dryH);
  await page.waitForTimeout(9000);
  await shot('after-road', -1.0, -14, -1.0, -44, 0, -0.10);
  await shot('after-gutter', 3.6, -30, 4.8, -40, 0, -0.30);
  await shot('after-basin', 3.4, -88, 4.7, -93, 0, -0.28);
  console.log('shots -> shots/wt-*.png');
}

await browser.close();
if (errors.length) { console.error('\nPAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('\nno page errors');
