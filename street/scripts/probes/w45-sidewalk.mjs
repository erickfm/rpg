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
// THE LAMPS ALTERNATE SIDES: (-4.1,-9), (4.1,-23), (-4.1,-37), (4.1,-51)...
// The first cut of this took the midpoint of two lamps on the SAME side, at
// z=-37 -- which is exactly where the opposite side's lamp stands. It was
// sampling a pool and calling it a gap, and it made the fix look like it had
// lifted the dark stretch by 2.26x when the dark stretch had never been
// measured. The true trough is the midpoint of CONSECUTIVE lamps, whichever
// side each is on.
const street = lamps.filter((l) => Math.abs(l.x) < 8 && l.z > -60 && l.z < 10)
  .sort((a, b) => b.z - a.z);
const A = street.find((l) => l.x > 0);            // a +x lamp: the pavement we watch
const nb = street.filter((l) => l !== A).sort((a, b) => Math.abs(a.z - A.z) - Math.abs(b.z - A.z))[0];
const gapZ = (A.z + nb.z) / 2;
console.log(`lamp A (${A.x}, ${A.z})  nearest neighbour (${nb.x}, ${nb.z})  true trough z=${gapZ.toFixed(1)}`);
console.log(`all street lamps: ${street.map((l) => `(${l.x},${l.z})`).join(' ')}`);

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
    // THE PAVEMENT BAND, not the road. At this camera the +x sidewalk runs
    // across the frame at roughly 48-52% of its height, which the saved
    // screenshot is there to confirm by eye. The first cut sampled 62-80% and
    // that is entirely roadway -- so it reported the road's brightness under
    // the heading "sidewalk", on both sides of the comparison.
    const y0 = Math.floor(c.height * 0.478), y1 = Math.floor(c.height * 0.522);
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
