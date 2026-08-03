#!/usr/bin/env node
// ITEM 211 — IS THE SIGNAL CONTRAST RATHER THAN TONE?
//
// Two predicates have already failed and both are written up in
// scripts/w5-shadow-census.mjs's header: a bare RATIO cannot separate the road
// (0.36, approved) from the alley floor (0.35, the user's sixth report), and
// ratio-plus-FLUSH excludes the very surface it was built for.
//
// This tests a third idea, and it comes out of item 186's OWN measurement
// rather than out of the air. 186 wrote:
//
//   "At 14.8/255 an sd of 8.4 has been compressed to about +/-3 levels: there
//    is no visible structure left, so what is on the screen is a black shape
//    with a clean edge lying over the paving."
//
// That is not a statement about tone. It is a statement about ABSOLUTE SCREEN
// CONTRAST — a surface stops reading as a material and starts reading as a
// shape when its grain, after the world's multiplicative grade, falls below
// what the eye can resolve. Relative grain is the wrong measure and 186 proved
// it: the alley floor had TWICE the sidewalk's relative grain (19.4% vs 9.7%)
// and still looked like a shadow, because 19.4% of nearly nothing is nothing.
//
// So: dump every ground surface's canvas mean, canvas sd, relative grain and
// the ABSOLUTE contrast it renders at, and see whether the road and the alley
// separate on the last of those when they do not on the first.
//
//   SHOT_URL=http://localhost:4261/ node scripts/probes/w70-ground-contrast.mjs
import { chromium } from 'playwright';
import { goto } from '../lib/reachable.mjs';
import { setClock } from '../lib/clock.mjs';
import { aim } from '../lib/aim.mjs';

const URL = aim('http://localhost:4261/');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 500 } });
// same seeding as the census: dither() paints with UNSEEDED Math.random, so a
// texture's mean moves a little every load
await page.addInitScript(() => {
  let s = 0x9e3779b9 >>> 0;
  Math.random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
});
await goto(page, URL);
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await page.evaluate(() => window.__ct.warp(-2, 0, 0, 0));
await page.waitForTimeout(900);
await setClock(page, 13, 0);

const rows = await page.evaluate(() => {
  const stat = (m) => {
    if (!m || !m.map || !m.map.image) return null;
    const im = m.map.image;
    if (!im.width || !im.height) return null;
    const cv = document.createElement('canvas');
    cv.width = im.width; cv.height = im.height;
    const g = cv.getContext('2d', { willReadFrequently: true });
    try { g.drawImage(im, 0, 0); } catch { return null; }
    let d; try { d = g.getImageData(0, 0, im.width, im.height).data; } catch { return null; }
    let s = 0, s2 = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      s += l; s2 += l * l; n++;
    }
    const mean = s / n;
    return { mean, sd: Math.sqrt(Math.max(0, s2 / n - mean * mean)), px: `${im.width}x${im.height}` };
  };
  const out = [];
  const sc = window.__ct.scene(); sc.updateMatrixWorld(true);
  sc.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    for (let q = o; q; q = q.parent) if (q.visible === false) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox, mw = o.matrixWorld;
    const lo = bb.min.clone().applyMatrix4(mw), hi = bb.max.clone().applyMatrix4(mw);
    const cy = (lo.y + hi.y) / 2;
    const dx = Math.abs(hi.x - lo.x), dy = Math.abs(hi.y - lo.y), dz = Math.abs(hi.z - lo.z);
    if (cy < -0.35 || cy > 0.55) return;
    const aXZ = dx * dz;
    if (aXZ < aXZ * 0 + Math.max(dx * dy, dz * dy) || aXZ < 1) return;
    if (Math.min(dx, dz) < 0.3 || dy > 0.35) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const mat = (o.geometry.type === 'BoxGeometry' && mats.length >= 3) ? mats[2] : mats[0];
    if (!mat) return;
    if (mat.transparent && (mat.opacity ?? 1) < 0.6) return;
    const st = stat(mat);
    if (!st) return;
    let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
    // THE TINT MATTERS HERE AND IT DID NOT IN THE CENSUS. The census reads the
    // canvas only, because updateRain rewrites m.color every frame and folding
    // it in made the count move with the weather. But SCREEN contrast is what
    // the eye judges, and the tint is a multiplier on it — so it is read here,
    // AT A FIXED CLOCK AND DRY, and reported separately so the two numbers can
    // be told apart.
    const c = mat.color;
    const tint = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
    out.push({ mod: mod ?? '(unattributed)', tag: o.userData?.alley ?? '',
      area: +aXZ.toFixed(1), x: +((lo.x + hi.x) / 2).toFixed(1), z: +((lo.z + hi.z) / 2).toFixed(1),
      px: st.px, mean: +st.mean.toFixed(1), sd: +st.sd.toFixed(2),
      tint: +tint.toFixed(3) });
  });
  return out;
});

const scored = rows.map((r) => ({
  ...r,
  screenMean: +(r.mean * r.tint).toFixed(1),
  screenSd: +(r.sd * r.tint).toFixed(2),
  rel: +(r.sd / Math.max(1, r.mean)).toFixed(3),
})).sort((a, b) => a.screenSd - b.screenSd);

console.log(`\n  ${scored.length} textured ground surfaces, sorted by SCREEN CONTRAST (sd x tint)\n`);
console.log('   screenSd  screenMean   canvasMean  canvasSd   rel   area   module            at');
for (const r of scored) {
  console.log(`   ${String(r.screenSd).padStart(7)}  ${String(r.screenMean).padStart(9)}`
    + `   ${String(r.mean).padStart(9)}  ${String(r.sd).padStart(7)}  ${String(r.rel).padStart(5)}`
    + `  ${String(r.area).padStart(5)}   ${(r.mod + (r.tag ? ':' + r.tag : '')).padEnd(16)}  ${r.x}, ${r.z}`);
}
await browser.close();
