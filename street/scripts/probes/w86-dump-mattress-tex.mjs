// DUMP THE SLEEP CENTER SHOPFRONT TEXTURE ITSELF. Item 166.
// A 3D view of a 13 m front seen from 11 m away cannot tell you whether a
// 0.3 m detail was painted or not. Read the canvas.
//   SHOT_URL=http://localhost:4420/ node scripts/probes/w86-dump-mattress-tex.mjs
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const URL = process.env.SHOT_URL || 'http://localhost:4420/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(700);

const r = await p.evaluate(() => {
  const S = window.__ct.scene(); S.updateMatrixWorld(true);
  const out = [];
  S.traverse((o) => {
    if (!o.isMesh) return;
    const e = o.matrixWorld.elements;
    // the SLEEP CENTER slot: EAST facade x = +7, z -22..-35
    // the shop BOX is centred at FACE + dep/2, so it can sit 10-12 m out in x
    if (e[12] < 3 || e[12] > 16 || e[14] > -22 || e[14] < -35) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      const img = m?.map?.image;
      if (!img?.getContext) continue;
      if (img.width < 200) continue;
      // UPSCALE NEAREST-NEIGHBOUR. A 208 x 67 PNG viewed at native size is
      // unreadable, and "I could not see it" is not "it is not there".
      const K = 6;
      const c = document.createElement('canvas');
      c.width = img.width * K; c.height = img.height * K;
      const cg = c.getContext('2d');
      cg.imageSmoothingEnabled = false;
      cg.drawImage(img, 0, 0, c.width, c.height);
      out.push({ w: img.width, h: img.height, url: c.toDataURL(),
        ppm: m.map.userData?.ppm ?? null, kind: m.map.userData?.kind ?? null });
    }
  });
  return out;
});
console.log(`${r.length} large textures on the slot`);
r.forEach((t, i) => {
  console.log(`  [${i}] ${t.w}x${t.h}  ppm=${t.ppm} kind=${t.kind}`);
  writeFileSync(`shots/w86-tex-${i}.png`, Buffer.from(t.url.split(',')[1], 'base64'));
});
await b.close();
