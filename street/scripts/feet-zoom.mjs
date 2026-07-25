// Crop the citizen out of an in-world shot and blow it up, so "which way does
// the toe point" is a thing you can SEE rather than squint at.
// Usage: SHOT_URL=... node scripts/feet-zoom.mjs
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
console.error(`[measuring ${process.env.SHOT_URL}]`);   // say WHICH world — 24163f69
await page.goto(process.env.SHOT_URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await page.waitForTimeout(500);
await page.evaluate(() => window.__ct.clock(13, 0));

const grab = () => page.evaluate(() => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    const g = o.geometry?.parameters;
    if (g && g.width === 0.95 && g.height === 1.9 && o.material?.alphaTest === 0.5 && Math.abs(o.position.x) < 8) {
      out.push({ x: +o.position.x.toFixed(2), z: +o.position.z.toFixed(2) });
    }
  });
  return out;
});
const a = await grab();
await page.waitForTimeout(800);
const b = await grab();
// Pair each sample with the same citizen in the later sample — matched on the
// LANE as well as on z. Matching on z alone pairs an east-walk citizen with a
// west-walk one at a similar z and reports a nonsense direction.
const paired = a.map((p) => {
  const same = b.filter((r) => Math.abs(r.x - p.x) < 0.5);
  if (!same.length) return null;
  const q = same.reduce((m, r) => Math.abs(r.z - p.z) < Math.abs(m.z - p.z) ? r : m, same[0]);
  return { ...q, dir: q.z > p.z + 0.05 ? 1 : q.z < p.z - 0.05 ? -1 : 0 };
}).filter((p) => p && p.dir !== 0);

// One from each walk. The west walk viewed from the road gives the MIRRORED
// profile column, the east walk viewed from the road gives the unmirrored one —
// so covering both sides covers both, which is the check the last two attempts
// at this skipped.
const pick = [paired.find((p) => p.x < 0), paired.find((p) => p.x > 0)].filter(Boolean);
for (const p of pick) {
  const side = p.x < 0 ? 1 : -1;              // stand in the road, whichever side
  const cx = p.x + side * 2.6;
  // eye level low and close, so the feet fill a good part of the frame
  await page.evaluate(([cx, cz, tx, tz]) =>
    window.__ct.warp(cx, cz, Math.atan2(tx - cx, -(tz - cz)), 0, -0.42), [cx, p.z, p.x, p.z]);
  await page.waitForTimeout(280);
  const shot = await page.screenshot({ clip: { x: 500, y: 300, width: 280, height: 340 } });
  const { writeFileSync } = await import('node:fs');
  // upscale 3x with nearest, in the page, so the texels stay crisp
  const b64 = shot.toString('base64');
  const up = await page.evaluate(async (b64) => {
    const img = new Image();
    await new Promise((r) => { img.onload = r; img.src = 'data:image/png;base64,' + b64; });
    const cv = document.createElement('canvas');
    cv.width = img.width * 3; cv.height = img.height * 3;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(img, 0, 0, cv.width, cv.height);
    // an arrow marking the direction of TRAVEL, drawn on top
    return cv.toDataURL();
  }, b64);
  const name = `${p.x < 0 ? 'westwalk' : 'eastwalk'}-${p.dir > 0 ? 'north' : 'south'}`;
  writeFileSync(`shots/feet-zoom-${name}.png`, Buffer.from(up.split(',')[1], 'base64'));
  // Looking WEST, north is screen-LEFT. Looking EAST, north is screen-RIGHT.
  const northIsLeft = side > 0;
  const want = (p.dir > 0) === northIsLeft ? 'screen-LEFT' : 'screen-RIGHT';
  console.log(`${name}: walking ${p.dir > 0 ? 'NORTH' : 'SOUTH'}, camera looks ${side > 0 ? 'WEST' : 'EAST'}` +
    ` => toe must appear ${want}  -> shots/feet-zoom-${name}.png`);
}
await browser.close();
