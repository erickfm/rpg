// w45 / item 95 — the sidewalk under a lamp against the sidewalk in the gap,
// framed from across the road so the pavement fills a known band of the frame.
//
// The first cut of this pointed the camera at its own feet and measured the
// PLAYER'S HANDS: both positions read 0.386 and the ratio came out 1.00x,
// which looks exactly like "the fix does nothing". The hands are drawn at the
// bottom centre of the frame at any downward pitch, so that region can never
// be used. BUILDER-BRIEF section 7, twice in one item.
//
// So: stand out in the roadway, look ACROSS at the pavement, and sample a band
// in the middle of the frame that the accompanying screenshot shows is
// sidewalk. Same camera geometry at both positions; only z changes.
//
//   SHOT_URL=http://localhost:4189/ node scripts/probes/w45-sidewalk.mjs [tag]
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { setNight } from '../lib/clock.mjs';

const TAG = process.argv[2] || 'after';
const URL = aim('http://localhost:4189/');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await setNight(page, 23, 0);

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
const run = lamps.filter((l) => l.x > 0 && l.x < 12 && l.z > -60 && l.z < 10).sort((a, b) => a.z - b.z);
const A = run[run.length - 1], B = run[run.length - 2];
const gapZ = (A.z + B.z) / 2;
console.log(`lamp A (${A.x}, ${A.z})  lamp B (${B.x}, ${B.z})  gap z=${gapZ.toFixed(1)}`);

// Out in the road, looking across at the +x pavement. Yaw +x is 0 in this rig's
// convention as used by the other probes' atan2 forms; pitch shallow so the
// hands stay out of the sampled band.
const look = async (z, tag) => {
  await page.evaluate(([zz]) => window.__ct.warp(-1.5, zz, Math.PI / 2, 0, -0.22), [z]);
  await page.waitForTimeout(450);
  const buf = await page.screenshot({ path: `shots/w45-sw-${tag}-${TAG}.png` });
  const b64 = buf.toString('base64');
  const v = await page.evaluate(async (s) => {
    const img = new Image();
    await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = 'data:image/png;base64,' + s; });
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    // A band across the FULL width, below the horizon and above the hands:
    // 62%-80% of frame height. The saved screenshot is there to confirm by eye
    // that this band is pavement.
    const y0 = Math.floor(c.height * 0.62), y1 = Math.floor(c.height * 0.80);
    const d = g.getImageData(0, y0, c.width, y1 - y0).data;
    let s2 = 0;
    for (let i = 0; i < d.length; i += 4) s2 += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    return +(s2 / (d.length / 4) / 255).toFixed(5);
  }, b64);
  console.log(`  ${tag.padEnd(6)} z=${String(z).padStart(6)}  pavement band luminance ${v.toFixed(5)}  -> shots/w45-sw-${tag}-${TAG}.png`);
  return v;
};

console.log(`\npavement seen from the roadway, 23:00:`);
const under = await look(A.z, 'under');
const gap = await look(gapZ, 'gap');
console.log(`\npeak/trough along the sidewalk: ${(under / Math.max(gap, 1e-5)).toFixed(2)}x`);
console.log(`A flat sidewalk reads 1.00x. Lamps 28 m apart with a 7 m reach`);
console.log(`should make this plainly greater than 1.`);
await browser.close();
