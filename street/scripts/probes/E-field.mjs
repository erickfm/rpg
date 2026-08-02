// STAND IN THE FIELD AND LOOK AT THE GRASS. The desk: "code presence is NOT
// the test". Same station, three times of day, plus a MEASUREMENT of what the
// mown bands actually resolve to on screen.
//
// The user's words were *"cut the contrast hard and narrow the bands"*, and
// both halves are numbers. Reading `MOW_BAND` and the two greens out of the
// source would only tell me what I typed — this file existed for a day taking
// three photographs and asserting nothing, which is the same shape that let a
// shelter roof float 0.20 m over its posts through two rebuilds.
//
// So: look down at the turf from standing height, scan a line across the
// rendered frame, and measure the bands as the player receives them.
//
//   CONTRAST is peak-to-trough luminance over the mean. Mown stripes are a nap
//     effect — light bouncing off grass bent two ways — and on a real pitch it
//     is a few percent. Past ~12% it stops reading as mowing and starts
//     reading as painted stripes, which is what the user photographed.
//   PERIOD is how wide one band is. A gang mower cuts a 0.5-1.5 m swathe.
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4182/';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1000, height: 600 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);

for (const [tag, h] of [['noon', 12], ['afternoon', 15], ['dusk', 19]]) {
  await page.evaluate(([h]) => window.__ct.clock(h, 30), [h]);
  await page.waitForTimeout(900);
  await page.evaluate(() => window.__ct.warp(-16.0, -80.0, -Math.PI / 2, 0.14, -0.10));
  await page.waitForTimeout(1100);
  await page.screenshot({ path: `shots/E-field/${tag}.png` });
}

// ── the measurement, on the mown texture itself ──────────────────────────────
//
// The first version of this scanned a line across the rendered frame and it
// was wrong: at eye height the only way to see much turf is to look down the
// field, and that line crossed a bench, a tree trunk and a desire line. It
// reported contrast going UP when I halved the difference between the two
// greens, which is how I know it was measuring the props and not the grass.
//
// The stripes are a texture, so measure the texture. It is authored at 16 px
// per metre, so a band's width in texels IS its width in metres, and the two
// greens are adjacent rows in it — no perspective, no props, no lighting.
// The screenshots above are for LOOKING; this is the part that can fail.
const band = await page.evaluate(() => {
  let img = null, best = 0;
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.material?.map?.image) return;
    if (!o.geometry?.boundingBox) o.geometry?.computeBoundingBox?.();
    const s = o.geometry?.boundingBox?.getSize?.(o.position.clone());
    // the field is the biggest vertex-coloured horizontal sheet in the park
    if (!o.material.vertexColors) return;
    const area = (s?.x ?? 0) * (s?.z ?? 0);
    if (area > best) { best = area; img = o.material.map.image; }
  });
  if (!img) return null;
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  c.getContext('2d').drawImage(img, 0, 0);
  // EVERY ROW, AVERAGED ACROSS THE WHOLE WIDTH — not one column down the
  // middle. A band spans the full width of the texture, so averaging a row
  // uses ~284 samples of the same band and divides the dither by sqrt(284).
  // One column carries the dither at full strength, and once the contrast was
  // cut to 7% that noise was the same size as the signal: it measured a
  // 1.00 m band as 3.30 m, then as 1.65 m after smoothing. Cutting the
  // contrast is what broke the naive read, so the read had to get better.
  const d = c.getContext('2d').getImageData(0, 0, img.width, img.height).data;
  const col = [];
  for (let y = 0; y < img.height; y++) {
    let a = 0;
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      a += 0.3 * d[i] + 0.6 * d[i + 1] + 0.1 * d[i + 2];
    }
    col.push(a / img.width);
  }
  return { col, w: img.width, h: img.height };
});
if (!band || band.col.length < 32) {
  console.log('EXIT 3: found no mown field texture to measure — the locator is wrong, not the field');
  await b.close(); process.exit(3);
}
const col = band.col;
const mean = col.reduce((a, c) => a + c, 0) / col.length;
// The texture is dithered, so a single texel is noise. Average each row band
// against its neighbours by taking the 10th and 90th percentile of the column:
// that is the light band and the dark band, with the dither excluded.
const sorted = col.slice().sort((a, c) => a - c);
const lo = sorted[Math.floor(col.length * 0.10)], hi = sorted[Math.floor(col.length * 0.90)];
const contrast = (hi - lo) / mean;
// N BANDS HAVE N-1 INTERNAL TRANSITIONS, not N.
//
// This divided the texture height by the CROSSING count, which over-reads by
// exactly one band's worth: 264 texels of 1.5 m bands is 11 bands and 10
// crossings, and 264/10/16 gives 1.65 m for something authored at 1.50. I saw
// that 1.65-against-1.50 earlier today, decided it was close enough, and moved
// on — and it came back as a FAIL the moment the desk asked for 1.5 m, on a
// world that was correct. An instrument that is 10% out is a check that will
// eventually argue with the truth.
let crossings = 0;
for (let i = 1; i < col.length; i++) if ((col[i - 1] - mean) * (col[i] - mean) < 0) crossings++;
const bandM = crossings ? (col.length / (crossings + 1)) / 16 : Infinity;

console.log(`mown texture ${band.w}x${band.h} px at 16 px/m`);
console.log(`  luminance  mean ${mean.toFixed(1)}  p10 ${lo.toFixed(0)}  p90 ${hi.toFixed(0)}`);
console.log(`  contrast   ${(100 * contrast).toFixed(1)}% between the light and dark band`);
console.log(`  band       ${bandM.toFixed(2)} m (${crossings} crossings down ${col.length} texels)`);

const fails = [];
if (contrast > 0.14) fails.push(`CONTRAST ${(100 * contrast).toFixed(1)}% — reads as painted stripes, not mowing`);
if (contrast < 0.015) fails.push(`CONTRAST ${(100 * contrast).toFixed(1)}% — no visible banding at all`);
if (bandM > 1.6) fails.push(`BAND ${bandM.toFixed(2)} m — wider than a gang mower's swathe`);
for (const f of fails) console.log('FAIL ', f);
if (!fails.length) console.log(`PASS  ${bandM.toFixed(2)} m bands at ${(100 * contrast).toFixed(1)}% contrast`);
await b.close();
process.exit(fails.length ? 1 : 0);
