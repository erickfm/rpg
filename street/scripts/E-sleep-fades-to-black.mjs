// DOES THE BED FADE THE SCREEN TO BLACK? Verifying K/C's row, not mine.
//
// STATION, and it is the one the row names: stand at the bed in 301, press the
// `[E]` that reads "sleep until morning", and WATCH THE SCREEN — not the clock.
// The whole history of this row is that the clock moved and the screen did not,
// so a check that only reads the clock re-confirms the bug.
//
// TWO METHOD RULES, both learned the expensive way today:
//
//  1. MEASURE THE PNG, NEVER THE LIVE CANVAS. A WebGL canvas discards its
//     drawing buffer after compositing, so `drawImage` on it returns a cleared
//     buffer BY DESIGN. H's own probe reported a constant 0.4979 through an
//     entire working fade and nearly filed "the fade does not happen" against
//     it; my frame guard in E-qpass hit the identical wall the same day.
//     `page.screenshot()` goes through the compositor and is unaffected.
//
//  2. THE `[E]` DISPATCH IS EDGE-TRIGGERED INSIDE THE FRAME LOOP. A Playwright
//     `press()` can fall between two frames and never be seen, which is
//     indistinguishable from "the feature is missing" — the failure that has
//     blocked four rows for me. So the key is HELD, and the run proves the
//     press landed (the clock moved) before it judges the screen at all.
//
//   node scripts/E-sleep-fades-to-black.mjs
//   SHOT_URL=http://localhost:4182/ node scripts/E-sleep-fades-to-black.mjs
//
// Exits 3 — "cannot answer" — if the press never lands, because a fade I could
// not trigger is not a fade I have shown to be broken (GOTCHAS §32).
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { reportWorld } from './lib/which-world.mjs';

const URL = aim('http://localhost:4182/');
const OUT = 'shots/E-sleepfade';
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 900, height: 600 } });
page.on('pageerror', (e) => console.error('PAGEERR', e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);

let fails = 0;
const report = (n, ok, d) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${d}`); };

// mean luminance of a frame, measured off the PNG the browser just composited
const lumaOf = async (png) => page.evaluate(async (b64) => {
  const img = new Image();
  img.src = `data:image/png;base64,${b64}`;
  await img.decode();
  const g = document.createElement('canvas');
  g.width = 80; g.height = 50;
  const x = g.getContext('2d');
  // top 78% only — the HUD strip at the bottom stays lit through the fade and
  // would floor the reading at a non-zero value forever
  x.drawImage(img, 0, 0, img.width, Math.floor(img.height * 0.78), 0, 0, 80, 50);
  const d = x.getImageData(0, 0, 80, 50).data;
  let s = 0;
  for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3;
  return s / (d.length / 4) / 255;
}, png.toString('base64'));

// `__ct.clockNow()` — the published reader. NOT `scene.userData.clockMin`,
// which I reached for first and which does not exist: the run then reported
// "the clock did not move (null -> null), the [E] never landed", which is a
// verdict about the world derived entirely from my own missing field. That is
// the shape of mistake this whole file is armoured against, and it got in
// through the armour.
const clock = () => page.evaluate(() => window.__ct.clockNow().totalMin);

// ── the station ──────────────────────────────────────────────────────────
// The spot list puts "sleep until morning" at (197.4, -15.8). Stand on it and
// face the bed. There is no SEAT in 301 — `__ct.seats()` returns none for that
// room — so the bed is reached as a spot, not by sitting.
await page.evaluate(() => window.__ct.clock(23, 10));
// THE FLOOR OF ROOM 301 IS AT 5.40, NOT 0. Warping with gy 0 aims the player
// at the pavement five metres below the bed. Ask the picker for the floor at
// the spot rather than assuming the interiors sit at ground level.
const floor = await page.evaluate(() => window.__ct.groundAt(197.4, -15.8));
await page.evaluate(([f]) => window.__ct.warp(197.4, -15.8, Math.PI, f, 0), [floor]);
await page.waitForTimeout(900);

// PROVE THE PROMPT IS UP BEFORE PRESSING ANYTHING. Without this the run cannot
// tell "the fade is broken" from "I was standing in the wrong place", which is
// the ambiguity that has blocked four rows on this block.
const promptUp = await page.evaluate(() =>
  /\[E\]\s*sleep until morning/.test(document.body.innerText));
if (!promptUp) {
  console.log(`\nEXIT 3: no "[E] sleep until morning" prompt at the station (floor ${floor}).`);
  console.log('I never reached the bed, so this run cannot judge the fade.');
  await b.close();
  process.exit(3);
}
console.log(`the prompt is up at floor ${floor} — the bed is in reach`);
const before = await clock();
const wallStart = Date.now();
const lit = await lumaOf(await page.screenshot({ path: `${OUT}/00-before.png` }));
console.log(`station (197.4, -15.8) in room 301 at 23:10 — screen luma before ${lit.toFixed(4)}`);

// NEGATIVE CONTROL: `E_NOPRESS=1` samples the same eleven frames from the same
// station WITHOUT pressing anything. It must exit 3 on the clock-jump gate — a
// green here would mean the trace is black for some reason of its own and the
// bed has nothing to do with it. A check nobody has watched fail is one you
// will argue with, and this is the one that decides another builder's row.
//
// HOLD the key: 260 ms spans several frames at any sane frame rate, so an
// edge-triggered dispatch cannot fall between two of them.
if (!process.env.E_NOPRESS) {
  await page.keyboard.down('e');
  await page.waitForTimeout(260);
  await page.keyboard.up('e');
}

// sample the screen across the fade, keeping the frames
const trace = [];
for (const t of [120, 250, 400, 550, 700, 850, 1000, 1200, 1500, 1900, 2400]) {
  await page.waitForTimeout(t - (trace.length ? trace[trace.length - 1].t : 0));
  const png = await page.screenshot({ path: `${OUT}/t-${String(t).padStart(4, '0')}.png` });
  trace.push({ t, luma: await lumaOf(png) });
}
const after = await clock();

// ── did the press land at all? ───────────────────────────────────────────
// A CLOCK THAT MOVED IS NOT A PRESS THAT LANDED. One real second is one game
// minute, so the clock ALWAYS moves — my first cut treated any movement as
// proof and cheerfully reported "the press landed: +0.1 h" for a run in which
// nothing happened but the passage of five seconds. The sleep is a JUMP: K's
// row measures +575 minutes. So subtract the time the run itself took and
// require what is left over to be a real jump.
const elapsedGameMin = (Date.now() - wallStart) / 1000;      // 1 s real = 1 min game
const advanced = after - before;
const jump = advanced - elapsedGameMin;
if (jump < 60) {
  console.log(`\nEXIT 3: the clock advanced ${advanced.toFixed(0)} min over ${elapsedGameMin.toFixed(0)} min of ordinary time`);
  console.log(`— a jump of only ${jump.toFixed(0)} min, so the [E] never landed.`);
  console.log('This run cannot say anything about the fade. A blocked verification, NOT a rejection.');
  await b.close();
  process.exit(3);
}
console.log(`the press landed: clock jumped +${jump.toFixed(0)} game minutes beyond the ${elapsedGameMin.toFixed(0)} the run itself took\n`);
for (const s of trace) console.log(`   t+${String(s.t).padStart(4)} ms   luma ${s.luma.toFixed(4)}${s.luma < 0.02 ? '   <- BLACK' : ''}`);

const darkest = trace.reduce((a, s) => (s.luma < a.luma ? s : a));
const brightest = trace.reduce((a, s) => (s.luma > a.luma ? s : a));
const blackFrames = trace.filter((s) => s.luma < 0.02);
const ended = trace[trace.length - 1];

// THE POSITIVE CONTROL, and it is needed because of WHEN this runs. The station
// is 23:10 in an unlit bedroom, so the screen before the press measures 0.0065
// — already almost black. "It went to 0.0000" against a start of 0.0065 is not
// evidence of anything, and quoting `lit` as the contrast would have been a
// green earned by the room being dark rather than by the fade working.
//
// What proves the measurement could see light at all is the ARC: a bright frame
// in the same trace, on the same scale, from the same camera.
report('the trace contains a lit frame, so a black one means something',
  brightest.luma > 0.15,
  `brightest sample is t+${brightest.t} ms at luma ${brightest.luma.toFixed(4)} — ${(brightest.luma / Math.max(darkest.luma, 0.0001)).toFixed(0)}x the darkest`);
report('the screen goes fully black at some point during the sleep',
  darkest.luma < 0.02,
  `darkest frame is t+${darkest.t} ms at luma ${darkest.luma.toFixed(4)}`);
report('…and it is HELD, not a single-frame flicker',
  blackFrames.length >= 2,
  `${blackFrames.length} sampled frames under 0.02, at ${blackFrames.map((s) => s.t).join(', ')} ms`);
report('…and the world comes back afterwards',
  ended.luma > 0.02,
  `last sample t+${ended.t} ms at luma ${ended.luma.toFixed(4)}`);

console.log(fails ? `\n${fails} FAILED` : '\nthe bed fades the screen to black, holds it, and returns');
await b.close();
process.exit(fails ? 1 : 0);
