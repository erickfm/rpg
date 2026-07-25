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
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { modes } from './lib/modes.mjs';

const mode = modes('wetness', ['probe', 'shots'], 'probe');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(page, process.env.SHOT_URL ?? 'http://localhost:4177/');   // GOTCHAS 26: prove it, do not just name it
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

const read = () => page.evaluate(() => {
  const sc = window.__ct.scene();
  const out = { pud: [], refl: [], strip: null, broad: null, rainOpacity: 0 };
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
    const sheet = im && ((im.width === 48 && im.height === 32) || (im.width === 16 && im.height === 64));
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
  await page.evaluate((h) => window.__ct.clock(h, 0), wetH);
  await page.waitForTimeout(5000);                       // let it come down
  const wet = await read();
  const rainingNow = wet.rainOpacity;
  console.log(`  during the storm: rain opacity ${rainingNow}, ` +
    `puddles ${wet.pud.filter((o) => o > 0.02).length}/${wet.pud.length} showing`);

  await page.evaluate((h) => window.__ct.clock(h, 0), dryH);
  const samples = [];
  for (let i = 0; i < 7; i++) {
    await page.waitForTimeout(2000);
    const r = await read();
    samples.push(r);
    const maxP = Math.max(...r.pud);
    console.log(`  +${((i + 1) * 2).toString().padStart(2)}s after the rain stops: ` +
      `rain ${r.rainOpacity.toFixed(3)}  strongest puddle ${maxP.toFixed(3)}  ` +
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
  // and the street must not be bone dry the moment it stops
  const streetStillWet = samples[samples.length - 1].broad !== wet.broad ||
                         samples[samples.length - 1].strip !== wet.strip;
  const stillDark = maxAt[maxAt.length - 1] > 0.05;
  // individual fill: they must not move in lockstep
  const spread = new Set(samples[3].pud.filter((o) => o > 0.02).map((o) => o.toFixed(3)));
  const individual = spread.size >= 3;
  // the gutter holds water longer than the road crown
  const gutterHolds = samples[3].strip !== samples[3].broad;

  console.log(`\n  ${rainStopped ? 'OK  ' : 'FAIL'} the rain actually stopped`);
  console.log(`  ${stillFilling ? 'OK  ' : 'FAIL'} puddles are STILL filling after it stops — they crest late ` +
    `(mean ${meanAt[0].toFixed(3)} -> ${meanAt[3].toFixed(3)})`);
  console.log(`  ${stillDark ? 'OK  ' : 'FAIL'} standing water outlasts the storm`);
  console.log(`  ${streetStillWet ? 'OK  ' : 'FAIL'} the street is still wet, not bone dry on the last drop`);
  console.log(`  ${individual ? 'OK  ' : 'FAIL'} puddles fill individually (${spread.size} distinct depths), not in lockstep`);
  console.log(`  ${gutterHolds ? 'OK  ' : 'FAIL'} the gutter and the road crown dry at different rates`);

  // DARKER THAN THE ROAD, AT EVERY HOUR. This replaces an assertion about a
  // REFLECTION layer that puddle pass five deleted — the check outlived the
  // feature by a day and was failing for the right reason with the wrong
  // message, which is its own kind of wrong.
  //
  // The contract now is simpler and stronger. The puddle body is tinted to a
  // fraction of the road's CURRENT colour every frame, so the composite lands
  // at ~0.55 x road whatever the hour and whatever the weather. The original
  // bug was that a FIXED dark sheet got overtaken when the wet tint crushed
  // the road six times darker, and the contrast inverted. Defined relative to
  // the road, it cannot.
  const contrastAt = async (h) => {
    await page.evaluate((hh) => window.__ct.clock(hh, 0), h);
    await page.waitForTimeout(9000);
    return page.evaluate(() => {
      const sc = window.__ct.scene();
      let road = null; const puds = [];
      sc.traverse((o) => {
        const im = o.material?.map?.image; if (!o.isMesh || !im) return;
        const c = o.material.color, L = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
        if (im.width === 64 && im.height === 64 && !o.material.transparent)
          road = road === null ? L : Math.min(road, L);       // asphalt is the darkest broad sheet
        if (im.width === 48 && im.height === 32 && o.material.transparent &&
            o.material.blending === 1 && o.material.opacity > 0.1)
          puds.push({ L, op: o.material.opacity });
      });
      if (road === null || !puds.length) return null;
      // ALL NINE, NOT THE FIRST ONE FOUND. This took `!pud` — it read whichever
      // pool the traversal reached first and judged the whole contract on it.
      // Nine pools carry different windows and different opacities, and the
      // claim being made is that NONE of them inverts; the worst is the only
      // one that can settle that. Same shape as basin.mjs probing one of two
      // castings: a verdict about a family, measured on one member.
      const comps = puds.map((q) => q.L * q.op + road * (1 - q.op));
      return { road: +road.toFixed(4),
               composite: +Math.max(...comps).toFixed(4),      // the least dark = worst case
               n: puds.length };
    });
  };
  const dayWet2 = [...Array(48).keys()].find((h) => rainy(h) && (h % 24) >= 11 && (h % 24) <= 16);
  const wetC = await contrastAt(dayWet2), dryC = await contrastAt(13);
  const levels = (c) => c ? ((c.road - c.composite) * 255).toFixed(1) : 'n/a';
  console.log(`\n  puddle against the road, in a storm at ${dayWet2 % 24}:00 — ` +
    `road ${wetC?.road}, worst of ${wetC?.n} pools ${wetC?.composite} => ${levels(wetC)} levels DARKER`);
  console.log(`  and on a dry afternoon — road ${dryC?.road}, puddle ${dryC?.composite} ` +
    `=> ${levels(dryC)} levels DARKER`);
  const neverInverts = wetC && dryC &&
    wetC.composite < wetC.road && dryC.composite < dryC.road;
  console.log(`  ${neverInverts ? 'OK  ' : 'FAIL'} standing water is darker than the road it sits on, wet AND dry`);
  if (!neverInverts) process.exitCode = 1;
  if (!rainStopped || !stillFilling || !stillDark || !streetStillWet || !individual || !gutterHolds) process.exit(1);
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
