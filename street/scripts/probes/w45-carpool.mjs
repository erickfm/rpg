// w45 / item 95 — "it doesnt affect the car at all", tested directly.
//
// Stand a car under a lamp head and photograph it, then stand the same car in
// the dark gap between lamps and photograph it again. If lamplight reaches a
// car, the first is warmer and brighter than the second. The world's own
// __ct.carVariant affordance places it, so this measures the real fleet body
// rather than a stand-in.
//
//   SHOT_URL=http://localhost:4189/ node scripts/probes/w45-carpool.mjs [tag]
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
const A = lamps.filter((l) => l.x > 0 && Math.abs(l.x) < 8).sort((a, b) => b.z - a.z)[0];
console.log(`lamp (${A.x}, ${A.z})`);

// Two positions on the same bit of roadway: right under the head, and 10 m
// down the street where LAMP_R (7 m) cannot reach.
const place = async (z, tag) => {
  const patched = await page.evaluate(([x, zz]) => {
    // clear any car this probe made earlier
    const sc = window.__ct.scene();
    const old = [];
    sc.traverse((o) => { if (o.userData && o.userData.probe) old.push(o); });
    for (const o of old) o.parent && o.parent.remove(o);
    const c = window.__ct.carVariant('sedan', {}, x, zz, 0);
    // A car built by carVariant exists long after buildProps ran, so it is in
    // no registry at all. props.ts now publishes the runtime way in.
    const add = window.__ct.scene().userData.addLit;
    if (add) add(c); else console.warn('no scene.userData.addLit — old build');
    let n = 0, p = 0;
    c.traverse((m) => {
      if (!m.isMesh || !m.material) return;
      for (const mm of (Array.isArray(m.material) ? m.material : [m.material])) {
        if (!mm || !mm.color) continue;
        n++;
        if (mm.customProgramCacheKey && mm.customProgramCacheKey() === 'w45pool') p++;
      }
    });
    return { n, p };
  }, [A.x - 3.2, z]);
  // look at the car from across the road
  await page.evaluate(([x, zz]) => window.__ct.warp(x, zz, Math.PI / 2, 0, -0.12), [A.x - 8.5, z]);
  await page.waitForTimeout(500);
  const buf = await page.screenshot({ path: `shots/w45-car-${tag}-${TAG}.png` });
  const lum = await page.evaluate(async (s) => {
    const img = new Image();
    await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = 'data:image/png;base64,' + s; });
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    // centre of the frame, where the car body sits
    const bw = Math.floor(c.width * 0.34), bh = Math.floor(c.height * 0.16);
    const d = g.getImageData(Math.floor((c.width - bw) / 2), Math.floor(c.height * 0.46), bw, bh).data;
    let t = 0;
    for (let i = 0; i < d.length; i += 4) t += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    return +(t / (d.length / 4) / 255).toFixed(5);
  }, buf.toString('base64'));
  console.log(`  ${tag.padEnd(6)} z=${z}  body materials patched ${patched.p}/${patched.n}  body luminance ${lum.toFixed(5)}  -> shots/w45-car-${tag}-${TAG}.png`);
  return lum;
};

// FIND A GENUINELY DARK SPOT, do not assume one. The lamps alternate sides
// every 14 m, so "11 m down the street from this lamp" lands 5.8 m from the
// NEXT one and is inside its pool -- which is how the first run of this probe
// photographed two lit cars and called one of them the control. Scan the
// roadway at the car's own x and take the z whose nearest lamp is furthest.
const darkZ = await page.evaluate(([carX, z0]) => {
  const ls = [];
  window.__ct.scene().traverse((o) => {
    if (o.userData && o.userData.lampPart === 'lens') {
      o.updateWorldMatrix(true, false);
      const e = o.matrixWorld.elements;
      ls.push({ x: e[12], z: e[14] });
    }
  });
  let best = null;
  for (let z = z0 + 2; z > z0 - 30; z -= 0.5) {
    const d = Math.min(...ls.map((l) => Math.hypot(l.x - carX, l.z - z)));
    if (!best || d > best.d) best = { z, d };
  }
  return best;
}, [A.x - 3.2, A.z]);
console.log(`darkest roadway spot near this lamp: z=${darkZ.z}, ${darkZ.d.toFixed(2)} m from the nearest of 21 heads`);

const under = await place(A.z, 'under');
const dark = await place(darkZ.z, 'dark');
console.log(`\ncar under a lamp against the same car 11 m away: ${(under / Math.max(dark, 1e-5)).toFixed(2)}x`);
console.log(`"it doesnt affect the car at all" is a reading of 1.00x.`);
await browser.close();
