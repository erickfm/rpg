// w45 / item 95 — IS THERE A POOL ON THE SIDEWALK, measured in PIXELS.
//
// The whole complaint is "the lighting only affects the street but not the
// sidewalk", so the check has to be: walk along the sidewalk and along the
// road, and see whether brightness RISES under a lamp and FALLS between lamps.
// A flat profile is the bug. A periodic one, with the peaks landing on the
// lamp positions, is the fix.
//
// Pixels rather than material colour, and that matters: the pool now happens
// at the fragment, so m.color carries only the ambient and a material-colour
// probe reads the world as uniformly dark whether the fix works or not. My own
// first check did exactly that and reported a regression that was not there.
//
// Self-contained — it needs no before-run to mean something, because the
// quantity it reports is a RATIO within a single frame: peak over trough along
// one strip of ground. Flat ground under evenly spaced lamps has a true value
// well above 1, and the old world could not produce it at any exposure.
//
//   SHOT_URL=http://localhost:4189/ node scripts/probes/w45-poolprofile.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { setNight } from '../lib/clock.mjs';

const URL = aim('http://localhost:4189/');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await setNight(page, 23, 0);

// The lamps, from the world's own geometry.
const lamps = await page.evaluate(() => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (o.userData && o.userData.lampPart === 'lens') {
      o.updateWorldMatrix(true, false);
      const e = o.matrixWorld.elements;
      out.push({ x: +e[12].toFixed(2), z: +e[14].toFixed(2) });
    }
  });
  return out;
});
// the main-street run on the +x side, which is the side the user's frame shows
const run = lamps.filter((l) => l.x > 0 && l.x < 12 && l.z > -60 && l.z < 10)
  .sort((a, b) => a.z - b.z);
console.log(`main street lamps on the +x side, north to south:`);
console.log(run.map((l) => `  (${l.x}, ${l.z})`).join('\n'));
if (run.length < 2) { console.log('need two lamps to have a gap'); await browser.close(); process.exit(1); }

// Look STRAIGHT DOWN from high up, so one frame covers a stretch of ground and
// every sample is the same surface seen the same way. Pitch is clamped by the
// rig, so the camera is raised instead and the shot is taken from a steep
// angle rather than a true plan view; the sampling below works either way,
// because it reads a horizontal band of the image rather than world points.
const midZ = (run[0].z + run[run.length - 1].z) / 2;
await page.evaluate((z) => window.__ct.warp(1.2, z, 0, 0, -1.2), midZ);
await page.waitForTimeout(500);

// Decode the frame in the page itself — no image library, and no question
// about what the bytes mean.
const shotB64 = (await page.screenshot({ path: 'shots/w45-profile.png' })).toString('base64');
const prof = await page.evaluate(async (b64) => {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  // mean luminance of each COLUMN, over the lower half of the frame (ground)
  const cols = [];
  const y0 = Math.floor(c.height * 0.55), y1 = c.height;
  for (let x = 0; x < c.width; x++) {
    let s = 0, n = 0;
    for (let y = y0; y < y1; y++) {
      const i = (y * c.width + x) * 4;
      s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; n++;
    }
    cols.push(s / n / 255);
  }
  return { w: c.width, h: c.height, cols };
}, shotB64);

// A column profile across a down-the-street view is a profile ACROSS the road,
// which is the wrong axis for lamp spacing. So also take a ROW profile, which
// runs up the image and therefore down the street as it recedes.
const rowProf = await page.evaluate(async (b64) => {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const rows = [];
  for (let y = 0; y < c.height; y++) {
    let s = 0, n = 0;
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; n++;
    }
    rows.push(s / n / 255);
  }
  return rows;
}, shotB64);

const stat = (a) => {
  const mn = Math.min(...a), mx = Math.max(...a);
  return { min: +mn.toFixed(4), max: +mx.toFixed(4), ratio: +(mx / Math.max(mn, 1e-4)).toFixed(2) };
};
console.log(`\ncolumn profile across the frame (ground half): ${JSON.stringify(stat(prof.cols))}`);
console.log(`row profile up the frame:                      ${JSON.stringify(stat(rowProf))}`);

// ── THE CHECK THAT ACTUALLY DECIDES IT ────────────────────────────────────
// Stand ON the sidewalk under a lamp and then in the gap between two lamps,
// look straight down at the pavement, and compare. Same surface, same camera,
// two positions. If the sidewalk takes lamplight the first is much brighter.
const patch = async (x, z, tag) => {
  await page.evaluate(([a, b]) => window.__ct.warp(a, b, 0, 0, -1.5), [x, z]);
  await page.waitForTimeout(420);
  const b64 = (await page.screenshot({ path: `shots/w45-patch-${tag}.png` })).toString('base64');
  return page.evaluate(async (s) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + s; });
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    // the centre of the LOWER portion of the frame is the ground at the
    // player's feet, whatever the pitch clamp allowed
    const bw = Math.floor(c.width * 0.3), bh = Math.floor(c.height * 0.25);
    const bx = Math.floor((c.width - bw) / 2), by = c.height - bh;
    const d = g.getImageData(bx, by, bw, bh).data;
    let s2 = 0;
    for (let i = 0; i < d.length; i += 4) s2 += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    return +(s2 / (d.length / 4) / 255).toFixed(5);
  }, b64);
};

const a = run[0], b = run[1];
const gapZ = (a.z + b.z) / 2;
const walkX = a.x + 1.4;                      // out on the sidewalk, off the kerb
const roadX = a.x - 3.0;                      // out in the roadway

console.log(`\nlamp A (${a.x}, ${a.z})  lamp B (${b.x}, ${b.z})  gap centre z=${gapZ.toFixed(1)}`);
const wUnder = await patch(walkX, a.z, 'walk-under');
const wGap = await patch(walkX, gapZ, 'walk-gap');
const rUnder = await patch(roadX, a.z, 'road-under');
const rGap = await patch(roadX, gapZ, 'road-gap');

const pr = (label, u, g) => console.log(`  ${label.padEnd(10)} under ${u.toFixed(5)}   gap ${g.toFixed(5)}   peak/trough ${(u / Math.max(g, 1e-5)).toFixed(2)}x`);
console.log(`\nground luminance at the player's feet, 23:00:`);
pr('SIDEWALK', wUnder, wGap);
pr('ROAD', rUnder, rGap);
console.log(`\nthe user's sentence, as a number: the sidewalk's peak/trough is`);
console.log(`${(wUnder / Math.max(wGap, 1e-5)).toFixed(2)}x against the road's ${(rUnder / Math.max(rGap, 1e-5)).toFixed(2)}x.`);
console.log(`Equal treatment means these two are close. A sidewalk near 1.00x is the bug.`);
await browser.close();
