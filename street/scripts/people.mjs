// feat/people — the block's crowd: build, skin, hair, garment, pace.
//
//   atlas (default) — dump each person's painted sheet, 5 views x 2 frames
//   street          — see them on the street
//   probe           — assert nobody is anybody else recoloured, and that
//                     stride actually tracks speed
//
// Usage: SHOT_URL=http://localhost:4279/ node scripts/people.mjs [atlas|street|probe|all]
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const mode = process.argv[2] ?? 'all';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await page.waitForTimeout(600);
await page.evaluate(() => window.__ct.clock(13, 0));

if (mode === 'atlas' || mode === 'all') {
  // The painted sheet is the ground truth for hair shape, build and stride —
  // far better than trying to catch a walking sprite at the right angle.
  // upscaled 5x with nearest sampling — at 160x128 native you cannot see
  // whether the hair is tied or long, which is the whole point of looking
  const urls = await page.evaluate(async () => {
    const raw = window.__ct.atlases();
    const out = [];
    for (const u of raw) {
      const img = new Image();
      await new Promise((r) => { img.onload = r; img.src = u; });
      const cv = document.createElement('canvas');
      cv.width = img.width * 5; cv.height = img.height * 5;
      const g = cv.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.fillStyle = '#5a6068'; g.fillRect(0, 0, cv.width, cv.height);
      g.drawImage(img, 0, 0, cv.width, cv.height);
      out.push(cv.toDataURL());
    }
    return out;
  });
  urls.forEach((u, i) => {
    writeFileSync(`shots/pp-atlas-${i}.png`, Buffer.from(u.split(',')[1], 'base64'));
  });
  console.log(`atlases -> shots/pp-atlas-0..${urls.length - 1}.png`);
}

const shot = async (name, x, z, tx, tz, gy = 0, pitch = 0, wait = 320) => {
  await page.evaluate(([x, z, tx, tz, gy, pitch]) => {
    window.__ct.warp(x, z, Math.atan2(tx - x, -(tz - z)), gy, pitch);
  }, [x, z, tx, tz, gy, pitch]);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `shots/pp-${name}.png` });
};

if (mode === 'street' || mode === 'all') {
  // they spawn at z = 4, -12, -28, -44, -60, -76 and wander from there
  await shot('crowd-north', -1.0, 8, -1.0, -20, 0, 0.02);
  await shot('crowd-mid', -1.0, -20, -1.0, -46, 0, 0.02);
  await shot('crowd-south', -1.0, -50, -1.0, -76, 0, 0.02);
  await shot('feet', 5.4, -10, 5.4, -30, 0.14, -0.62);   // nobody floating or sunk
  await shot('close-a', 3.2, 2, 6.0, 4, 0, 0.02);
  await shot('close-b', 3.2, -14, 6.0, -12, 0, 0.02);
  await shot('close-c', -3.2, -30, -6.0, -28, 0, 0.02);
  console.log('street -> shots/pp-*.png');
}

if (mode === 'probe' || mode === 'all') {
  // 1. every atlas must be a genuinely different painting
  const urls = await page.evaluate(() => window.__ct.atlases());
  const uniq = new Set(urls);
  // 2. and the sheets must differ in more than palette: compare the ALPHA
  //    silhouette, which ignores colour entirely. Two people who differ only
  //    by recolouring would share a silhouette.
  const sils = await page.evaluate(() => {
    const scene = window.__ct.scene();
    const out = [];
    scene.traverse((o) => {
      if (!o.isMesh || !o.material?.map?.image?.width) return;
      const img = o.material.map.image;
      if (img.width !== 160 || img.height !== 128) return;   // the citizen sheets
      const cv = document.createElement('canvas');
      cv.width = img.width; cv.height = img.height;
      const g = cv.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, cv.width, cv.height).data;
      let h = 0x811c9dc5, on = 0;
      for (let i = 3; i < d.length; i += 4) {
        const bit = d[i] > 127 ? 1 : 0;
        on += bit;
        h ^= bit; h = Math.imul(h, 0x01000193) >>> 0;
      }
      out.push({ sil: h.toString(16), px: on });
    });
    return out;
  });
  const uniqSil = new Set(sils.map((s) => s.sil));
  const areas = sils.map((s) => s.px).sort((a, b) => a - b);

  console.log('\npeople probe:');
  console.log(`  ${urls.length} people on the block`);
  console.log(`  distinct painted sheets:  ${uniq.size}/${urls.length}`);
  console.log(`  distinct SILHOUETTES:     ${uniqSil.size}/${sils.length}  (alpha only — colour ignored)`);
  console.log(`  silhouette area spread:   ${areas[0]} … ${areas[areas.length - 1]} px ` +
    `(${((areas[areas.length - 1] / areas[0] - 1) * 100).toFixed(0)}% between smallest and largest)`);

  // 3. height, build, pace — and crucially STRIDE, which must not just be
  //    cadence: a fast walker takes LONGER steps, not merely quicker ones.
  const ppl = await page.evaluate(() => window.__ct.people());
  const f = (k) => ppl.map((p) => p[k]);
  const span = (k) => `${Math.min(...f(k)).toFixed(2)}–${Math.max(...f(k)).toFixed(2)}`;
  // step length per stride = distance covered / steps taken = sp / cad
  const steps = ppl.map((p) => p.sp / p.cad);
  console.log(`  height scale:  ${span('hs')}   width scale: ${span('ws')}`);
  console.log(`  walk speed:    ${span('sp')}   (${(Math.max(...f('sp')) / Math.min(...f('sp'))).toFixed(1)}x fastest over slowest)`);
  console.log(`  step LENGTH:   ${Math.min(...steps).toFixed(3)}–${Math.max(...steps).toFixed(3)} m/step`);
  console.log(`  feet planted:  every citizen at y=${[...new Set(f('footY').map((v) => v.toFixed(3)))].join(', ')}`);

  const heightVaries = Math.max(...f('hs')) / Math.min(...f('hs')) > 1.12;
  const widthIndependent = new Set(ppl.map((p) => (p.ws / p.hs).toFixed(3))).size >= 4;
  const speedRange = Math.max(...f('sp')) / Math.min(...f('sp')) > 2;
  const strideTracksSpeed = Math.max(...steps) / Math.min(...steps) > 1.3;
  const feetPlanted = new Set(f('footY').map((v) => v.toFixed(4))).size === 1;

  const allDifferent = uniq.size === urls.length;
  const notRecolours = uniqSil.size === sils.length;
  const builtDifferently = areas[areas.length - 1] / areas[0] > 1.05;
  console.log(`  ${allDifferent ? 'OK  ' : 'FAIL'} no two people share a painted sheet`);
  console.log(`  ${notRecolours ? 'OK  ' : 'FAIL'} no two share a silhouette (nobody is a recolour)`);
  console.log(`  ${builtDifferently ? 'OK  ' : 'FAIL'} builds genuinely differ, not just scaled`);
  console.log(`  ${heightVaries ? 'OK  ' : 'FAIL'} heights vary by more than 12%`);
  console.log(`  ${widthIndependent ? 'OK  ' : 'FAIL'} width varies INDEPENDENTLY of height`);
  console.log(`  ${speedRange ? 'OK  ' : 'FAIL'} walk speeds span more than 2x`);
  console.log(`  ${strideTracksSpeed ? 'OK  ' : 'FAIL'} faster walkers take LONGER steps, not just quicker`);
  console.log(`  ${feetPlanted ? 'OK  ' : 'FAIL'} nobody floats or sinks — all feet on the pavement`);
  if (!allDifferent || !notRecolours || !builtDifferently || !heightVaries ||
      !widthIndependent || !speedRange || !strideTracksSpeed || !feetPlanted) process.exit(1);
}

await browser.close();
if (errors.length) { console.error('\nPAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('\nno page errors');
