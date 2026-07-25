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

// A RAINY NIGHT HOUR AND A RAINY DAY ONE, PICKED FROM THE SCHEDULE. These were
// hard-coded 5 and 15, which rained under the old lattice and do not under the
// corrected one — the same mirroring bug as the predicate, one level up: a
// constant chosen because it happened to hold when it was written.
const NIGHT_H = (() => { for (let h = 0; h < 240; h++) { const hh = h % 24;
  if (SCHEDULE[h] && (hh >= 22 || hh <= 6)) return h; } return 5; })();
const DAY_H = (() => { for (let h = 0; h < 240; h++) { const hh = h % 24;
  if (SCHEDULE[h] && hh >= 11 && hh <= 16) return h; } return 15; })();
const PAIR = [NIGHT_H, DAY_H];
console.log(`  rainy hours from the world's own schedule: ${NIGHT_H % 24}:00 (night), ${DAY_H % 24}:00 (day)`);

for (const h of PAIR) {
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
const both = PAIR.every((h) => results[h].rainVisible);
console.log(`  ${both ? 'OK  ' : 'FAIL'} it rains at BOTH hours (${NIGHT_H%24}:00 ${results[NIGHT_H].rainVisible}, ${DAY_H%24}:00 ${results[DAY_H].rainVisible})`);
const water = PAIR.every((h) => results[h].shown > 0);
console.log(`  ${water ? 'OK  ' : 'FAIL'} standing water forms at both (${NIGHT_H%24}:00 ${results[NIGHT_H].shown}, ${DAY_H%24}:00 ${results[DAY_H].shown})`);
const c5 = Math.abs(results[NIGHT_H].rainLum - results[NIGHT_H].skyLum) * results[NIGHT_H].rainOpacity * 255;
const c15 = Math.abs(results[DAY_H].rainLum - results[DAY_H].skyLum) * results[DAY_H].rainOpacity * 255;
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

const rainyH = (h) => rainyFromWorld(h);  // asked, not mirrored — see below
// BOTH HOURS MUST BE DAYLIGHT. The first attempt took the first rainy and first
// dry hour of a 48 h sweep and got midnight, where the night grade has already
// crushed everything and the weather cannot be read off it.
const day = (h) => (h % 24) >= 11 && (h % 24) <= 16;
let wetH = -1, dryH = -1;
for (let h = 0; h < 48; h++) {
  if (wetH < 0 && rainyH(h) && day(h)) wetH = h;
  if (dryH < 0 && !rainyH(h) && day(h)) dryH = h;
}

// SOAK SHORT, BECAUSE THE SIGNAL SATURATES. The pools cap at 0.900 each, and
// the mean climbs 0s:0 · 3s:0.028 · 6s:0.232 · 9s:0.507 · 14s:0.763 at 11:00.
// Sample late enough and every reading is the ceiling, which is how this check
// stopped being able to fail: canfail's rain-memory run read 0.9000 both while
// raining and after, so "the pools go on filling" was satisfied by two numbers
// that were merely both full. It had CAUGHT the same mutation before, on a run
// that happened to catch them a hair off the cap — a 0.005 margin deciding it.
//
// Six seconds leaves the mean around 0.23 with room above it, so filling and
// draining are different numbers rather than the same ceiling.
// SOAK TO A LEVEL, NOT FOR A TIME. Six seconds put the mean around 0.23 at
// idle — comfortably unsaturated — and under four concurrent browsers the same
// six seconds returned 0.9000, the cap, at every sample point. That is the
// saturated regime this check cannot discriminate in: it is exactly how
// rain-memory came to SLEEP (0fdf2ecd), reappearing under load rather than over
// time. GOTCHAS 30, on my own fix from one commit ago.
//
// So poll for the depth instead of counting seconds. Anything the render loop
// drives has to be waited ON, not waited OUT.
// START DRY. The rain-visibility block above samples two rainy hours, which
// leaves the pools at their cap — so the soak loop below exited on its first
// read with 0.9000 and measured nothing. Draining is no good either: dryFor is
// 48 s and up by design. A reload is the cheap deterministic dry world.
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
// THE ABSOLUTE HOUR, NOT h % 24. crosstown.ts:567 is `clock: (h, m) => { totalMin
// = h * 60 + m }` and hourAbs is `Math.floor(totalMin / 60)` — so the hour you
// pass IS the absolute hour, and rainAt keys on it. Passing `h % 24` after
// searching the schedule for an absolute h silently tests a DIFFERENT hour: pick
// 95 as rainy and you set hour 23, whose weather is whatever it happens to be.
// The time of day still wraps correctly, so nothing looks wrong.
// OUTDOORS FIRST, for the same reason wetness.mjs now does it: ct/props.ts cuts
// the weather when the player is indoors ("it NEVER rains indoors"), and the
// spawn is room 301 at x 198.6. The shots section below already warps; this
// memory half never did, so it soaked from inside a building and measured a
// pool level of 0 for 25 s before giving up.
await page.evaluate(() => window.__ct.warp(-1.0, -30, 0, 0, -0.05));
await page.waitForTimeout(300);
await page.evaluate((h) => window.__ct.clock(h, 0), wetH);
const SOAK_TO = 0.25, SOAK_CAP = 25000;
const t0 = Date.now();
let soaked = await wetSignal();
while (soaked < SOAK_TO && Date.now() - t0 < SOAK_CAP) {
  await page.waitForTimeout(250);
  soaked = await wetSignal();
}
if (soaked < SOAK_TO) {
  console.error(`\n  FAIL the pools never reached ${SOAK_TO} in ${SOAK_CAP} ms (got ${soaked})`);
  process.exitCode = 1;
}
await page.evaluate((h) => window.__ct.clock(h, 0), dryH);   // absolute, as above
await page.waitForTimeout(1200);
const justAfter = await wetSignal();
await page.waitForTimeout(12000);
const later = await wetSignal();

const remembers = justAfter >= soaked * 0.95;   // rain off and the water has not gone
// CRESTS NEAR FULL, not merely "deeper than before". Both worlds keep filling
// for the thirteen seconds after the rain stops — puddleLevel lags wetness with
// an ~11 s constant, so a street that forgot the weather instantly STILL rises
// for a while from a low start. Measured:
//
//   remembers   0.2703 -> 0.4408 -> 0.9000    fills to the cap
//   forgets     0.2654 -> 0.4174 -> 0.5627    stalls half way
//
// Direction is identical in both and cannot separate them; the DEPTH REACHED
// can. That is what "make wetness last a lil after it stops raining" buys — the
// pools go on filling to full off water that fell before the rain stopped.
const crests = later >= 0.75;
console.log(`\n  mean standing water  raining ${soaked.toFixed(4)}` +
  `  1.2 s after it stops ${justAfter.toFixed(4)}  +13 s ${later.toFixed(4)}`);
console.log(`  ${remembers ? 'OK  ' : 'FAIL'} the street stays wet after the rain stops`);
console.log(`  ${crests ? 'OK  ' : 'FAIL'} and the pools go on filling, as authored`);

await browser.close();
if (errors.length) { console.error('\nPAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
if (!both || !water || !remembers || !crests) process.exit(1);
console.log('\nno page errors');
