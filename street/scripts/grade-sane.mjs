// THE GRADE NEVER PRODUCES AN IMPOSSIBLE COLOUR — at any hour of the day.
//
// Named for what it asserts (GOTCHAS 24). Not to be confused with:
//   nightgrade.mjs  does everything the dimmer TOUCHED actually dim   (A's)
//   regrade.mjs     a one-off regrading pass
// This one asks a narrower and duller question of every material in the world:
// is its colour a real number, is it within the range the grade can produce,
// and is its opacity in 0..1.
//
// COLOUR IS NOT BOUNDED AT 1.0, AND MUST NOT BE ASSERTED TO BE. This file used
// to print "every material colour is a real number in 0..1" while testing only
// NaN and negative — an upper bound it claimed and never checked, and could not
// have checked, because a correct world exceeds 1.0 on purpose:
//
//     WARM_R = 1.15, WARM_G = 1.05, WARM_B = 0.85     (ct/props.ts)
//
// Sodium light WARMS a surface rather than repainting it, so the base colour is
// MULTIPLIED by that factor instead of lerped toward amber — a dark green sedan
// stays a dark green sedan, slightly warmer, where lerping dragged every dark
// texel toward brown and read as a graphics bug. A near-white tint times 1.15
// is 1.15, and clips at render. That is the accepted cost of the technique.
//
// ⚠ THOSE NUMBERS MOVED TO THE GPU — RE-MEASURED 2026-08-03, ITEM 234.
//
// This header used to record "nothing over 1.0 between 09:00 and 17:00, 20 of
// 5536 through the night, and 156-166 at the four ramp hours where a full
// ambient and a warm lamp term are both live. Worst 1.1497 at 23:00." **Every
// one of those is now zero**, measured on the built bundle at 45ecf9316:
//
//     swept 24 hours, 10962 materials each — 0 impossible values
//     deliberately over 1.0: 0 material-hours, peak 0.0000 — none
//
// `544053b20` ("lamplight per fragment") moved the warm term AND the gain into
// POOL_FRAG, so `ct/props.ts:1494` writes a pooled material only `base * amb`
// with `amb <= 1`. The warm multiply that used to push a colour over 1.0 no
// longer happens in JS at all, and **a fragment shader is invisible to anything
// reading `material.color`.** The overshoot did not stop; it moved out of view.
//
// THE CEILING CLAUSE BELOW IS NOT VACUOUS, AND THAT WAS WORTH CHECKING RATHER
// THAN ASSUMING. The dead statistic is the `deliberately over 1.0` COUNT, which
// is reporting rather than asserting. The assertion — nothing may exceed
// WARM_R — still guards the branch the CPU pass still owns, over a population
// of 10962 materials with a floor under it, and it is watched failing:
// `canfail grade-twice` was run on 2026-08-03 and CAUGHT, as was `grade-nan`.
//
// WHAT IS GENUINELY UNCOVERED IS THE GPU SIDE, and it is asserted in
// `scripts/glow.mjs` instead of duplicated here — that check already reads
// pixels, and this one owns no screenshot machinery. POOL_FRAG caps its
// multiplier at 1.0, so the ground under a lamp can never be brighter at night
// than at midday beyond the warm term's own luminance (1.0571 for the WARM_*
// below). glow.mjs measures 0.72 against a 1.11 ceiling and goes red at 1.63
// when POOL_FRAG's multiply is applied twice.
//
// SO ASSERT THE BOUND THAT ACTUALLY EXISTS. `mul` is capped at 1 and `base` is
// captured at build time from an authored colour, so the most the grade can
// produce is exactly WARM_R. Anything above it means something multiplied twice
// — a second writer on a material this module owns, an uncapped pool gain, a
// warm term applied to an already-warmed colour. That is a real failure with a
// real number attached, where "0..1" was a real failure of a correct world.
//
// WHY IT EXISTS. Six rounds of coverage audit went after space — one of two
// basins, one of nine pools, one street of three. It never asked about TIME.
// Every check on this shelf samples 13:00, 23:00 and 03:00, and the grade ramps
// between them: ct/props.ts multiplies material colours every frame from the
// night curve, the lamp pools and the wet registry, all three of which move
// fastest at dawn and dusk, which is precisely where nothing was looking.
//
// A NaN colour is the failure this is really for. It does not throw, it does not
// log, and three.js will happily upload it — you get a black or white mesh, or
// nothing, and no clue where it came from. The same applies to a negative
// component or an opacity outside 0..1. All of them are silent, and silent is
// the class this project keeps being bitten by.
//
// NOT A CHECK ON THE OVERSHOOT. Sweeping 24 hours used to find 739
// material-hours with a colour component above 1.0 — zero in full day, 9 at
// night, 91-94 at each of 07, 08, 18 and 19. That was real and it was NOT
// asserted here, because 1.08 clamps at render and is pixel-identical to 1.0:
// it would be a red line for something nobody can see. It is recorded in
// notes/B-routed-to-others.md with the numbers, and if tone mapping ever
// arrives it becomes a defect that day.
//
// **That figure is 0 today, for the same reason as the ceiling numbers above:
// the warm term left JS at `544053b20`.** The line that prints it is kept
// deliberately — a permanent, honest zero with an explanation beside it is what
// a moved subsystem should look like from here, and if it ever goes non-zero
// again something has started warming colours on the CPU once more, which is
// exactly the news worth having.
//
//   SHOT_URL=http://localhost:4279/ node scripts/grade-sane.mjs
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { reportWorld } from './lib/which-world.mjs';
import { installMats } from './lib/materials.mjs';
import { setClock } from './lib/clock.mjs';

const URL = aim('http://localhost:4177/');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message)));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);
// 4008d7c3 put the multi-material walk in the page so four checks stop
// retyping it. This one had its own correct copy; one place is better.
await installMats(page);

const bad = [];
let materials = 0;
// WAIT ON THE FRAME, not on a number I picked. I found this delay and named the
// mechanism wrong — "settle ramp" — and 2558b1ba corrected it: the grade does
// not lerp, it costs one rendered frame, and a too-early read returns the
// PREVIOUS time of day in full rather than a half-applied one. Measured both
// ways before accepting the correction:
//
//   23:00 on a FRESH page                 100:0  200:0  400:0  800:9  1600:9
//   23:00 from an already-running world   100:9  200:9  400:9  800:9  1600:9
//
// My repair was 250 ms per hour, which is still a guess — a slower machine or a
// throttled tab moves the number and nothing says so. lib/clock.mjs waits on
// two rendered frames and reports if its cap wins instead of degrading quietly.
// The ceiling comes from ct/props.ts, not from a number typed here. If the warm
// factor is retuned this check retunes with it; if it is retuned by ACCIDENT,
// the mismatch shows up as a parse failure rather than as a quietly wider bar.
const propsSrc = readFileSync(import.meta.dirname + '/../src/proto/ct/props.ts', 'utf8');
const warm = propsSrc.match(/const WARM_R = ([\d.]+), WARM_G = ([\d.]+), WARM_B = ([\d.]+);/);
if (!warm) {
  console.error('\n  FAIL cannot find WARM_R/WARM_G/WARM_B in ct/props.ts — the ceiling');
  console.error('  below is derived from them and I will not guess it.');
  process.exit(1);
}
const CEIL = Math.max(+warm[1], +warm[2], +warm[3]) + 0.005;
console.log(`\n  grade ceiling from ct/props.ts: WARM ${warm[1]}/${warm[2]}/${warm[3]} -> nothing may exceed ${CEIL.toFixed(3)}`);
let peak = 0, peakWho = '', overs = 0;

for (let h = 0; h < 24; h++) {
  const t = await setClock(page, h, 0);
  if (t.capped) { console.log(`  ${h}:00 — setClock hit its cap; this hour is not trustworthy`); process.exitCode = 1; }
  const r = await page.evaluate((ceil) => {
    const out = { n: 0, faults: [], over: 0, peak: 0, peakWho: '' };
    window.__ct.scene().traverse((o) => {
      if (!o.isMesh || !o.material) return;
      for (const m of window.__mats(o)) {
        const c = m.color; if (!c) continue;
        out.n++;
        const who = () => `${o.userData.mod ?? '?'} ${o.geometry?.type ?? ''} ` +
          `at ${o.position.x.toFixed(1)},${o.position.z.toFixed(1)}`;
        if (!isFinite(c.r) || !isFinite(c.g) || !isFinite(c.b))
          out.faults.push(`NaN colour — ${who()}`);
        else if (Math.min(c.r, c.g, c.b) < -1e-6)
          out.faults.push(`negative colour ${Math.min(c.r, c.g, c.b).toFixed(3)} — ${who()}`);
        else if (Math.max(c.r, c.g, c.b) > ceil)
          out.faults.push(`colour ${Math.max(c.r, c.g, c.b).toFixed(4)} over the ${ceil} grade ceiling — ${who()}`);
        const mx = Math.max(c.r, c.g, c.b);
        if (mx > 1.0001) { out.over++; if (mx > out.peak) { out.peak = mx; out.peakWho = who(); } }
        if (!isFinite(m.opacity) || m.opacity < -1e-6 || m.opacity > 1.0001)
          out.faults.push(`opacity ${m.opacity} — ${who()}`);
      }
    });
    return out;
  }, CEIL);
  materials = Math.max(materials, r.n);
  for (const f of r.faults) bad.push(`${String(h).padStart(2)}:00  ${f}`);
  overs += r.over;
  if (r.peak > peak) { peak = r.peak; peakWho = `${String(h).padStart(2)}:00 ${r.peakWho}`; }
}

// DID IT SWEEP ANYTHING? `bad` empty is the pass, and `bad` is empty when the
// traverse found nothing to look at — 24 hours of zero materials reads exactly
// like 24 hours of clean ones. 5536 materials at HEAD, measured; the floor is
// well below that because the world grows and shrinks, and well above zero
// because that is the failure being guarded.
if (materials < 2000) {
  console.log(`\n  FAIL swept 24 hours and found only ${materials} materials — expected thousands.`);
  console.log(`  "No impossible values" over an empty set is not a pass. Did __mats`);
  console.log(`  install, and does the scene still traverse?`);
  process.exitCode = 1;
}
console.log(`\n  swept 24 hours, ${materials} materials each — ${bad.length} impossible values`);
for (const line of bad.slice(0, 10)) console.log(`      ${line}`);
if (bad.length > 10) console.log(`      … and ${bad.length - 10} more`);
console.log(`  deliberately over 1.0: ${overs} material-hours, peak ${peak.toFixed(4)} — ${peakWho || 'none'}`);
if (!overs) console.log(`      (0 is expected since 544053b20 — the warm term is applied in POOL_FRAG`);
if (!overs) console.log(`       and cannot be seen from material.color. The GPU ceiling is asserted`);
if (!overs) console.log(`       in scripts/glow.mjs. Non-zero here means the CPU is warming again.)`);
console.log(`\n  ${!bad.length ? 'OK  ' : 'FAIL'} every material colour is a real number, never negative, at every hour`);
console.log(`  ${!bad.length ? 'OK  ' : 'FAIL'} nothing exceeds the ${CEIL.toFixed(3)} the grade can produce — nothing is warmed twice`);
console.log(`  ${!bad.length ? 'OK  ' : 'FAIL'} every opacity is in 0..1 (where an upper bound DOES mean something)`);

await browser.close();
if (errors.length) { console.error('\nPAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
if (bad.length) process.exit(1);
console.log('\nno page errors');
