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
//
// WHAT THIS DELIBERATELY DOES NOT ASSERT, and why. The complaint had a third
// half — "the same windows at 4am as at 8pm" — and a warm-pixel count cannot
// support it. Measured while writing this:
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
// The two assertions kept are ones the measure can carry. The third needs the
// lit-sheet opacities read from the scene, not pixels counted off a frame.
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

const noon = await warmAt(13);
const night = await warmAt(21);

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
say(errors.length === 0, 'no page errors', errors.length ? errors[0] : 'none');

if (SELFTEST) {
  // Break it on purpose: assert the DEFECT — that noon is lit — and require
  // that to fail. If it passes, the measurement is not reading the world.
  console.log('\nselftest — asserting the original defect, which must FAIL');
  const before = fails;
  say(noon > 1500, 'noon is as lit as night (the bug)', `${noon} warm px`);
  const caught = fails - before;
  console.log(caught === 1
    ? '\nSELFTEST PASSED — the inverted assertion was caught'
    : '\nSELFTEST FAILED — the inverted assertion passed, so this measures nothing');
  await browser.close();
  process.exit(caught === 1 ? 0 : 1);
}

await browser.close();
console.log(fails ? `\n${fails} FAILURES` : '\nwindow lights keep the block\'s hours');
process.exit(fails ? 1 : 0);
