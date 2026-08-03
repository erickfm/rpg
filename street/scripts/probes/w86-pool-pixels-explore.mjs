// EXPLORATORY, item 234: what numbers does a PIXEL measurement of the lamp pool
// actually give, and does a day/night normalisation cancel base colour?
//
// The measurement under test is a difference-in-differences:
//     gainNear = lum(night, under a lamp) / lum(day, under a lamp)
//     gainFar  = lum(night, 6 m along)   / lum(day, 6 m along)
//     pool     = gainNear / gainFar
// Dividing by the DAY reading at the same spot cancels whatever the ground is
// painted — which is the exact defect that let glow.mjs's side street pass on
// eight neon signs (w86-is-glows-side-street-green-real.mjs).
//
//   SHOT_URL=http://localhost:4420/ node scripts/probes/w86-pool-pixels-explore.mjs
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { installMats } from '../lib/materials.mjs';

const URL = process.env.SHOT_URL || 'http://localhost:4420/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 640, height: 480 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await installMats(p);

// are the side street's near samples self-lit signs?
const who = await p.evaluate(() => {
  const S = window.__ct.scene(); S.updateMatrixWorld(true);
  const lamps = [];
  S.traverse((o) => {
    if (o.isMesh && (o.userData.lampPart === 'lens' || o.userData.parkLantern)) {
      const e = o.matrixWorld.elements; lamps.push([e[12], e[14]]);
    }
  });
  const out = [];
  S.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    for (const mat of window.__mats(o)) {
      if (!mat.map) continue;
      if (!o.userData.graded && !mat.userData?.graded) continue;
      const e = o.matrixWorld.elements, x = e[12], z = e[14];
      if (!(x > 9 && z < -94)) return;
      const d = Math.min(...lamps.map(([lx, lz]) => Math.hypot(x - lx, z - lz)));
      if (d < 3.0) out.push({ mod: o.userData.mod ?? '?', selfLit: !!mat.userData?.selfLit, d: +d.toFixed(2) });
    }
  });
  return out;
});
console.log(`\nside-street NEAR population (glow.mjs's 8 samples):`);
console.log(`  ${who.filter((w) => w.selfLit).length} of ${who.length} are SELF-LIT (neon signs / lit windows, held bright on purpose)`);
for (const w of who) console.log(`      ${w.mod.padEnd(8)} selfLit=${w.selfLit}  d=${w.d}`);

const lamps = await p.evaluate(() => {
  const S = window.__ct.scene(); S.updateMatrixWorld(true);
  const out = [];
  S.traverse((o) => {
    if (o.isMesh && (o.userData.lampPart === 'lens' || o.userData.parkLantern)) {
      const e = o.matrixWorld.elements; out.push([+e[12].toFixed(2), +e[14].toFixed(2)]);
    }
  });
  return out;
});
const main = lamps.filter(([x, z]) => Math.abs(x) <= 9 && z <= 2 && z >= -96);
const side = lamps.filter(([x, z]) => x > 9 && z < -94);
console.log(`\n${lamps.length} lamps: ${main.length} main street, ${side.length} side street`);

/** mean luminance of the CENTRAL crop, looking steeply down at the ground */
async function ground(x, z, tag) {
  await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, undefined, -1.35), [x, z]);
  await p.waitForTimeout(450);
  const buf = await p.screenshot();
  if (tag) writeFileSync(`shots/w86-${tag}.png`, buf);
  return p.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    // CENTRAL CROP: a whole frame at this pitch still catches sky and facades at
    // the edges, and they are not what the question is about.
    const x0 = Math.floor(c.width * 0.3), y0 = Math.floor(c.height * 0.3);
    const w = Math.floor(c.width * 0.4), h = Math.floor(c.height * 0.4);
    const d = g.getImageData(x0, y0, w, h).data;
    let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    return s / (d.length / 4) / 255;
  }, buf.toString('base64'));
}

for (const [name, list] of [['main', main], ['side', side]]) {
  console.log(`\n── ${name} street ──────────────────────────────`);
  for (const [lx, lz] of list.slice(0, 4)) {
    const spots = [[lx, lz, 'under'], [lx, lz + 6, 'far']];
    const lum = {};
    for (const hour of [13, 23]) {
      await p.evaluate((h) => window.__ct.clock(h, 0), hour);
      await p.waitForTimeout(700);
      for (const [x, z, k] of spots) lum[`${k}${hour}`] = await ground(x, z, `${name}-${lz}-${k}-${hour}`);
    }
    const gN = lum.under23 / Math.max(lum.under13, 1e-6);
    const gF = lum.far23 / Math.max(lum.far13, 1e-6);
    console.log(`  lamp (${lx},${lz})  day u/f ${lum.under13.toFixed(4)}/${lum.far13.toFixed(4)}` +
      `  night u/f ${lum.under23.toFixed(4)}/${lum.far23.toFixed(4)}` +
      `  gain ${gN.toFixed(3)}/${gF.toFixed(3)} = ${(gN / gF).toFixed(2)}x`);
  }
}
await b.close();
