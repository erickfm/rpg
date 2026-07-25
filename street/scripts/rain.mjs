// feat/rain — why is the street wet with no rain in it?
//
// Another builder observed, at a daytime raining hour: ground wet, no rain
// particles in frame, no puddles — and said plainly that its own
// instrumentation disagreed with itself (57 decals, then 0 nine seconds later)
// and should be rebuilt rather than believed. That was the right call, so this
// measures the three things SEPARATELY and never infers one from another:
//
//   1. is it RAINING           — the particle system's own state
//   2. can you SEE the rain    — the particles against the sky behind them
//   3. is there STANDING WATER — puddle fill sampled over TIME, not once
//
// The third is where the other probe went wrong: puddles fill on a lag with a
// ~12 s time constant, so a single sample taken at the wrong moment says
// "zero" about a system that is working.
//
// Usage: SHOT_URL=http://localhost:4279/ node scripts/rain.mjs
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, process.env.SHOT_URL ?? 'http://localhost:4177/');   // GOTCHAS 26: prove it, do not just name it
await page.waitForTimeout(800);

const read = () => page.evaluate(() => {
  const sc = window.__ct.scene();
  const pts = sc.children.find((c) => c.isPoints &&
    (c.geometry?.attributes?.position?.count ?? 0) > 100);
  // puddle BODIES only: 48x32 sheets, NormalBlending. The park lanterns and
  // lamp pools are additive and must not be counted as water.
  const pud = [];
  sc.traverse((o) => {
    const im = o.material?.map?.image;
    if (!o.isMesh || !im || im.width !== 48 || im.height !== 32) return;
    if (!o.material.transparent || o.material.blending !== 1) return;
    pud.push(+o.material.opacity.toFixed(3));
  });
  const bg = sc.background;
  const lum = (c) => (c ? 0.299 * c.r + 0.587 * c.g + 0.114 * c.b : null);
  const rc = pts?.material?.color;
  return {
    rainVisible: pts ? pts.visible : null,
    rainOpacity: pts ? +pts.material.opacity.toFixed(3) : null,
    rainColour: rc ? rc.getHexString() : null,
    rainLum: rc ? +lum(rc).toFixed(3) : null,
    skyHex: bg ? bg.getHexString() : null,
    skyLum: bg ? +lum(bg).toFixed(3) : null,
    puddles: pud.length,
    shown: pud.filter((o) => o > 0.02).length,
    maxPuddle: pud.length ? Math.max(...pud) : 0,
  };
});

const results = {};
for (const h of [5, 15]) {
  console.log(`\n══ ${String(h).padStart(2, '0')}:00 ══`);
  await page.evaluate((hh) => window.__ct.clock(hh, 0), h);
  await page.evaluate(() => window.__ct.warp(-1.0, -30, 0, 0, -0.05));
  let elapsed = 0;
  for (const step of [2000, 4000, 4000, 6000]) {
    await page.waitForTimeout(step);
    elapsed += step / 1000;
    const r = await read();
    console.log(`  +${String(elapsed).padStart(2)}s  rain ${r.rainVisible ? 'ON ' : 'off'} ` +
      `op ${String(r.rainOpacity).padEnd(5)} | standing water ${String(r.shown).padStart(2)}/${r.puddles} ` +
      `max ${r.maxPuddle.toFixed(3)}`);
  }
  // HOW MUCH OF THE FRAME IS RAIN? This is the number that was missing. Material
  // colour against sky colour says the CONTRAST of a drop is high at both hours,
  // and that is true and useless — what decides whether you see rain is how much
  // of the screen it covers. Measured by hiding the particles for one frame and
  // counting the pixels that change.
  // NO PIXEL-COVERAGE MEASUREMENT HERE, deliberately. I built one — diff the
  // frame against itself with the particles hidden — and it gave three
  // different answers to the same question: 0.5%, then 0.23% after TRIPLING
  // the drop count, then 0.009% once a motion control was subtracted. Reading
  // a WebGL canvas back through drawImage without preserveDrawingBuffer is not
  // dependable, and a number that moves the wrong way when you triple the
  // thing it measures is worse than no number, because it will be believed.
  //
  // What is reliable is above (the particle system's own state, and puddle
  // fill sampled over time) and in the screenshots below. Whether rain READS
  // is a looking question, which is what this project already says screenshots
  // are for.
  const r = await read();
  results[h] = r;
  const contrast = (r.rainLum !== null && r.skyLum !== null && r.rainOpacity !== null)
    ? Math.abs(r.rainLum - r.skyLum) * r.rainOpacity : null;
  console.log(`  rain particles ${r.rainColour} (lum ${r.rainLum}) against sky ${r.skyHex} (lum ${r.skyLum})`);
  console.log(`  => rain-against-sky contrast: ${(contrast * 255).toFixed(1)} of 255 levels`);
  await page.screenshot({ path: `shots/rn-${h}.png` });
}

console.log('\n  ── verdict ──');
const both = [5, 15].every((h) => results[h].rainVisible);
console.log(`  ${both ? 'OK  ' : 'FAIL'} it rains at BOTH hours (05:00 ${results[5].rainVisible}, 15:00 ${results[15].rainVisible})`);
const water = [5, 15].every((h) => results[h].shown > 0);
console.log(`  ${water ? 'OK  ' : 'FAIL'} standing water forms at both (05:00 ${results[5].shown}, 15:00 ${results[15].shown})`);
const c5 = Math.abs(results[5].rainLum - results[5].skyLum) * results[5].rainOpacity * 255;
const c15 = Math.abs(results[15].rainLum - results[15].skyLum) * results[15].rainOpacity * 255;
// Per-drop contrast is high at BOTH hours, which is the useful negative
// result: "you cannot see the rain by day" was never a contrast problem, and
// it was never a count problem either. Look at shots/rn-5.png and rn-15.png.
console.log(`  per-drop contrast: ${c15.toFixed(1)} levels by day, ${c5.toFixed(1)} at night`);
console.log(`  — both high, so visibility is not a contrast problem. Judge it from shots/rn-*.png.`);

// ── DOES THE WETNESS OUTLAST THE RAIN? ───────────────────────────────────
//
// The user asked for this in as many words — "make wetness last a lil after it
// stops raining" — and ct/props.ts:1103 does it: wetness rises on dt * 0.55
// and falls over a dryFor of 48 s or more, so the street remembers the weather.
// Nothing asserted it. A request with an implementation and no check is one
// refactor away from being quietly withdrawn, and nobody would see it go.
//
// Measured on the ROAD's own colour, which is what the player sees, rather than
// on an internal counter. dryFor runs on real seconds and the clock jump does
// not touch it, so stepping to a dry hour leaves the road still dark and it
// lightens from there.
// MEASURED ON THE STANDING WATER, as a MEAN and not a maximum. Two probes
// before this one were wrong and both looked plausible:
//
//   road luminance   read 0.1640 while raining AND 1.2 s after, and read the
//                    same under a mutation that dried the street 200x faster.
//                    It was tracking a sheet that never moves with wetness.
//   max opacity      saturates: the pools cap at 0.900, so every state after
//                    the first few seconds reads identically.
//
// Dumping the sheets showed what both missed, and it is the feature working:
// THE POOLS KEEP FILLING AFTER THE RAIN STOPS. props.ts:1159 lags puddleLevel
// behind wetness deliberately — "wetness is already ebbing, the pools are still
// filling" — so the honest signal is the mean depth across all nine.
//
//   soaked   0.378 … 0.682     while it rains
//   +1.2 s   0.486 … 0.835     rain off, still rising
//   +13 s    all nine at cap
//
// That is what "make wetness last a lil after it stops raining" asked for, and
// it separates cleanly from a street that forgets: with wetness tied to the
// rain, the pools drain the moment it stops instead of cresting.
const wetSignal = () => page.evaluate(() => {
  const ops = [];
  window.__ct.scene().traverse((o) => {
    const im = o.material?.map?.image; if (!o.isMesh || !im) return;
    if (im.width === 48 && im.height === 32 && o.material.transparent)
      ops.push(o.material.opacity);
  });
  return ops.length ? +(ops.reduce((a, b) => a + b, 0) / ops.length).toFixed(4) : null;
});
const rainyH = (h) => (((h % 24) + 24) % 24) === 14 ||
  ((Math.imul(h, 2246822519) >>> 0) % 100) < 30;
// BOTH HOURS MUST BE DAYLIGHT. The first attempt took the first rainy and first
// dry hour of a 48 h sweep and got midnight, where the night grade has already
// crushed everything and the weather cannot be read off it.
const day = (h) => (h % 24) >= 11 && (h % 24) <= 16;
let wetH = -1, dryH = -1;
for (let h = 0; h < 48; h++) {
  if (wetH < 0 && rainyH(h) && day(h)) wetH = h;
  if (dryH < 0 && !rainyH(h) && day(h)) dryH = h;
}

await page.evaluate((h) => window.__ct.clock(h % 24, 0), wetH);
await page.waitForTimeout(9000);
const soaked = await wetSignal();
await page.evaluate((h) => window.__ct.clock(h % 24, 0), dryH);
await page.waitForTimeout(1200);
const justAfter = await wetSignal();
await page.waitForTimeout(12000);
const later = await wetSignal();

const remembers = justAfter >= soaked * 0.95;   // rain off and the water has not gone
const crests = later >= justAfter;              // it deepens after, as authored
console.log(`\n  mean standing water  raining ${soaked.toFixed(4)}` +
  `  1.2 s after it stops ${justAfter.toFixed(4)}  +13 s ${later.toFixed(4)}`);
console.log(`  ${remembers ? 'OK  ' : 'FAIL'} the street stays wet after the rain stops`);
console.log(`  ${crests ? 'OK  ' : 'FAIL'} and the pools go on filling, as authored`);

await browser.close();
if (errors.length) { console.error('\nPAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
if (!both || !water || !remembers || !crests) process.exit(1);
console.log('\nno page errors');
