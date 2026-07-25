// feat/wet — the street remembers the weather.
//
// Everything here is TIMING, so none of it can be shown in a still. The probe
// drives the clock from a rainy hour to a dry one and samples what happens
// after the last drop lands.
//
// Usage: SHOT_URL=http://localhost:4279/ node scripts/wet.mjs [probe|shots|all]
import { chromium } from 'playwright';

const mode = process.argv[2] ?? 'probe';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await page.waitForTimeout(500);

// same predicate ct/props.ts uses, so we pick hours the world agrees are wet
// The world's rain predicate, duplicated here because scripts cannot import
// from the TS module. It has an EXCEPTION now — 14:00 always rains, to put
// the first storm 40 s from spawn — so a script that picks "the first dry
// hour" must know about it or it will pick a wet one. Keep in step with
// rainAt() in ct/props.ts.
const rainy = (h) => (((h % 24) + 24) % 24) === 14 ||
  ((Math.imul(h, 2246822519) >>> 0) % 100) < 30;
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

  // THE REFLECTION. This is the fix for the contrast inversion, and the whole
  // claim is that it scales with the LIGHT rather than being a fixed sheet —
  // so it must be strong in a daytime storm and near nothing in a small-hours
  // one, in the same world state otherwise. A fixed sheet cannot do that, and
  // a sheet that fails this is back to being a pale smear on a dark road.
  const dayWet = [...Array(48).keys()].find((h) => rainy(h) && (h % 24) >= 11 && (h % 24) <= 16);
  const nightWet = [...Array(48).keys()].find((h) => rainy(h) && ((h % 24) <= 3 || (h % 24) >= 22));
  const reflAt = async (h) => {
    await page.evaluate((hh) => window.__ct.clock(hh, 0), h);
    await page.waitForTimeout(9000);
    return Math.max(...(await read()).refl);
  };
  const rDay = await reflAt(dayWet), rNight = await reflAt(nightWet);
  console.log(`\n  reflection in a storm at ${dayWet % 24}:00 = ${rDay.toFixed(3)}, ` +
    `at ${nightWet % 24}:00 = ${rNight.toFixed(3)}`);
  const scales = rDay > 0.25 && rNight < rDay * 0.25;
  console.log(`  ${scales ? 'OK  ' : 'FAIL'} standing water REFLECTS, and the reflection scales with the light`);
  if (!scales) process.exitCode = 1;
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
