// w90 — does `midBlock`'s z-only walk explain the skipped side-street lamp?
//
// glow.mjs's midBlock() holds x and walks z. The MAIN street runs along z
// (lamps at x = +-4.1, z from -9 to -93), so "walk z" is "walk along the
// pavement". The SIDE street runs along X (lamps at (20,-98.9), (34,-107.1),
// (45,-98.9)), so the same walk goes ACROSS it and off onto whatever lies
// north/south — which is exactly what the daylight control rejects at
// (34,-107.1): 0.3962 vs 0.5780, 0.69x.
//
// This probe reads the DAYTIME luminance of candidate controls along both axes
// for all three side lamps, so the axis question is answered by measurement
// rather than by reading the geometry and guessing.
//
// Usage: SHOT_URL=http://localhost:4460/ node scripts/probes/w90-sidestreet-midblock-axis.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { goto } from '../lib/reachable.mjs';
import { installMats } from '../lib/materials.mjs';
import { waitPainted } from '../lib/painted.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 880, height: 750 } });
await goto(page, aim('http://localhost:4177/'));
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await installMats(page);
await page.waitForTimeout(500);

const propsSrc = readFileSync(import.meta.dirname + '/../../src/proto/ct/props.ts', 'utf8');
const LAMP_R = +propsSrc.match(/const LAMP_R = ([\d.]+), LAMP_CORE = ([\d.]+);/)[1];

const lampXZ = await page.evaluate(() => {
  const S = window.__ct.scene(); S.updateMatrixWorld(true);
  const out = [];
  S.traverse((o) => {
    if (o.isMesh && (o.userData.lampPart === 'lens' || o.userData.parkLantern)) {
      const e = o.matrixWorld.elements; out.push([+e[12].toFixed(2), +e[14].toFixed(2)]);
    }
  });
  return out;
});
const minLampD = (x, z) => Math.min(...lampXZ.map(([lx, lz]) => Math.hypot(x - lx, z - lz)));

// same crop and pose as glow.mjs groundLum, so the numbers are comparable
const groundLum = async (x, z) => {
  await page.evaluate(([x, z]) => window.__ct.warp(x, z, 0, undefined, -1.35), [x, z]);
  await waitPainted(page, { quiet: true });
  const buf = await page.screenshot({});
  return page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const x0 = Math.floor(c.width * 0.30), y0 = Math.floor(c.height * 0.15);
    const w = Math.floor(c.width * 0.40), h = Math.floor(c.height * 0.40);
    const d = g.getImageData(x0, y0, w, h).data;
    let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    return s / (d.length / 4) / 255;
  }, buf.toString('base64'));
};

const SIDE = lampXZ.filter(([x, z]) => x > 9 && z < -94);
console.log(`side-street lamps: ${SIDE.map((L) => `(${L[0]},${L[1]})`).join(' ')}`);
console.log(`LAMP_R = ${LAMP_R}\n`);

await page.evaluate(() => window.__ct.clock(13, 0));
await page.waitForTimeout(900);

for (const [lx, lz] of SIDE) {
  const near = await groundLum(lx, lz);
  console.log(`lamp (${lx},${lz}) — daytime AT THE LAMP ${near.toFixed(4)}`);
  for (const axis of ['z', 'x']) {
    // nearest qualifying spot on each side, exactly as midBlock picks it
    for (const s of [-1, 1]) {
      let found = null;
      for (let d = 3; d <= 20; d += 0.25) {
        const x = axis === 'x' ? lx + s * d : lx;
        const z = axis === 'z' ? lz + s * d : lz;
        if (minLampD(x, z) >= LAMP_R) { found = { x: +x.toFixed(2), z: +z.toFixed(2), d, m: +minLampD(x, z).toFixed(2) }; break; }
      }
      if (!found) { console.log(`   ${axis}${s > 0 ? '+' : '-'}: no spot outside LAMP_R within 20 m`); continue; }
      const far = await groundLum(found.x, found.z);
      const ratio = near / Math.max(far, 1e-6);
      const ok = ratio > 0.8 && ratio < 1.25;
      console.log(`   ${axis}${s > 0 ? '+' : '-'}: (${found.x},${found.z}) at ${found.d} m, nearest lamp ${found.m} m — `
        + `day ${far.toFixed(4)} vs ${near.toFixed(4)} = ${ratio.toFixed(2)}x  ${ok ? 'COMPARABLE' : 'rejected'}`);
    }
  }
  console.log('');
}

await browser.close();
