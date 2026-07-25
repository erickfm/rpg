// feat/window-lights — are the flats lit at NIGHT and dark at NOON?
//
// The user's complaint was not "the windows look wrong", it was specific and
// temporal: *"the same windows are lit at 4am as at 8pm"* — and, the part you
// actually notice, lit at one in the afternoon. The lights used to be painted
// INTO `facadeTex`, so a block at midday was a block with its lamps on.
//
// `9ca895b0` is the rule this follows: **guard the defect, not the quality.**
// So this does not ask whether the lighting is nice. It asks the three things
// that were wrong, each of which can fail:
//
//   1. at 13:00 the upper floors are DARK          (the defect, exactly)
//   2. at 21:00 a good number of them are LIT      (the fix did something)
//   3. the rooms lit at 3am are NOT the rooms lit at 9pm
//
// (3) WAS CUT, AND IS NOW BACK BY A DIFFERENT MEASURE. A warm-pixel count
// cannot carry it. Measured when this file was written:
//
//     21:00  2936     03:00  2476     06:00  0
//
// 3am reads 84 % of 9pm when the curve puts 8 % of windows up against 19 %,
// and 6am reads ZERO while its windows are genuinely half lit. The count is
// non-linear in opacity (a window at 0.35 never crosses the warm threshold)
// and it happily counts a lamp halo or a red fascia as warm. I moved the
// camera twice trying to make the ratio behave and stopped, because tuning a
// threshold until it agrees is how you get a check that measures the tuning.
//
// What I wrote instead was that it "needs the lit-sheet opacities read from
// the scene, not pixels counted off a frame" — so that is what it now does.
// `ct/street.ts` stamps `userData.litSheet` = 'evening' | 'late' on each sheet,
// because WHICH SET OF ROOMS a sheet is, is a fact only the painter has; a
// camera can never recover it. Read directly, the same four hours are
// unambiguous:
//
//     13:00  evening 0     late 0
//     21:00  evening 1     late 0
//     03:00  evening 0     late 1
//     06:00  evening 0.235 late 0.331     <- the hour the pixel count read as 0
//
// Same move as `userData.facing` in scripts/shells.mjs, and for the same
// reason: when a measurement cannot see something, have the module that knows
// publish it, rather than tuning a threshold until it appears to.
//
// The crop is the LEFT 64 % and TOP 42 % of the frame from a fixed camera:
// that excludes the street lamp on the right and the BURGER BARN fascia, both
// of which are warm and neither of which is a window.
//
//   SHOT_URL=http://localhost:PORT/ node scripts/windowlights.mjs [--selftest]
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const SELFTEST = process.argv.includes('--selftest');
const URL = process.env.SHOT_URL ?? 'http://localhost:4231/';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message)));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, URL);
await page.waitForTimeout(900);

// One camera, mid-block, looking down the street so both elevations are in
// frame. Never moves — the only variable is the hour.
//
// SETTLE TIME: 700 ms, and that is enough HERE — checked, not assumed.
// 2bdebbcf measured that the grade LERPS after a clock jump (at 23:00 an
// out-of-range count reads 0 at 500 ms and 9 from 1000 ms on) and cd91d251
// raised scenedump to 2 s because its hash reads material COLOUR, which is
// what is still moving. This file reads colour too, so I sampled the ramp:
//
//     13:00  warm 0     at 700 / 1300 / 2000 / 3000 ms
//     21:00  warm 2936  at 700 / 1300 / 2000 / 3000 ms
//     03:00  warm 2476  at 700 / 1300 / 2000 / 3000 ms
//
// Flat. `setWindows` assigns sheet opacity straight from the hour with no
// interpolation, and the warm crop is dominated by the sheets rather than by
// the graded facade behind them. A check that read facade colour would need
// the 2 s; this one does not, and now says why rather than leaving the next
// person to re-derive it.
const warmAt = async (hour) => {
  await page.evaluate((h) => window.__ct.clock(h, 0), hour);
  await page.evaluate(() => window.__ct.warp(-1.2, -40, Math.PI, 0, 0.30));
  await page.waitForTimeout(700);
  return page.evaluate(() => {
    const shot = document.querySelector('canvas');
    const cv = document.createElement('canvas');
    const g = cv.getContext('2d');
    cv.width = shot.width; cv.height = shot.height;
    g.drawImage(shot, 0, 0);
    const d = g.getImageData(0, 0, Math.round(cv.width * 0.64),
      Math.round(cv.height * 0.42)).data;
    let warm = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      if (r > 140 && gg > 110 && b < 130 && r - b > 55) warm++;
    }
    return warm;
  });
};

// The sheet opacities, straight off the materials. No camera involved, so no
// crop, no threshold, and nothing a lamp halo can contribute to.
const sheetsAt = async (hour) => {
  await page.evaluate((h) => window.__ct.clock(h, 0), hour);
  await page.waitForTimeout(500);
  return page.evaluate(() => {
    const out = {};
    window.__ct.scene().traverse((m) => {
      const k = m.userData && m.userData.litSheet;
      if (!k) return;
      out[k] = { n: (out[k]?.n ?? 0) + 1, op: +m.material.opacity.toFixed(3) };
    });
    return out;
  });
};

const noon = await warmAt(13);
const night = await warmAt(21);
const s21 = await sheetsAt(21);
const s03 = await sheetsAt(3);

let fails = 0;
const say = (ok, name, detail) => {
  if (!ok) fails++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}: ${detail}`);
};

// The thresholds are ABSOLUTE and hardcoded, deliberately. Deriving them from
// each other — "noon must be less than night" alone — would pass a world with
// every window dark at every hour, which is the failure the original painter
// had in the other direction.
say(noon < 200, 'nothing is lit at one in the afternoon', `${noon} warm px in the crop`);
say(night > 1500, 'the block is lit at nine at night', `${night} warm px`);

// The half of the complaint the pixel count could not reach. Both directions
// are asserted: a world that lit the 'late' sheet at both hours would satisfy
// one of these and read exactly as the bug did.
const swaps = (s21.evening?.op ?? 0) > (s21.late?.op ?? 0)
           && (s03.late?.op ?? 0) > (s03.evening?.op ?? 0);
say(Object.keys(s21).length === 2, 'both sets of rooms exist',
  `sheets stamped: ${Object.keys(s21).join(', ') || 'NONE — is street.ts stamping litSheet?'}`);
say(swaps, 'the rooms lit at 3am are not the rooms lit at 9pm',
  `21:00 evening ${s21.evening?.op} / late ${s21.late?.op}` +
  ` · 03:00 evening ${s03.evening?.op} / late ${s03.late?.op}`);
say(errors.length === 0, 'no page errors', errors.length ? errors[0] : 'none');

if (SELFTEST) {
  // Break it on purpose: assert the DEFECT — that noon is lit — and require
  // that to fail. If it passes, the measurement is not reading the world.
  console.log('\nselftest — asserting the original defect, which must FAIL');
  const before = fails;
  say(noon > 1500, 'noon is as lit as night (the bug)', `${noon} warm px`);
  say((s03.evening?.op ?? 0) >= (s21.evening?.op ?? 0),
    'the same rooms burn all night (the bug)',
    `evening sheet 03:00 ${s03.evening?.op} vs 21:00 ${s21.evening?.op}`);
  const caught = fails - before;
  console.log(caught === 2
    ? '\nSELFTEST PASSED — both inverted assertions were caught'
    : `\nSELFTEST FAILED — only ${caught} of 2 caught, so this measures less than it claims`);
  await browser.close();
  process.exit(caught === 2 ? 0 : 1);
}

await browser.close();
console.log(fails ? `\n${fails} FAILURES` : '\nwindow lights keep the block\'s hours');
process.exit(fails ? 1 : 0);
