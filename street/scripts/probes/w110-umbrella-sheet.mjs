// THE UMBRELLA SHEET ITSELF, MAGNIFIED AND COUNTED.
//
// A 1.14 m billboard seen from 2 m is about 90 screen px; every judgement about
// "does it read as a hat" is really a judgement about 38x38 texels, and at that
// size the frame cannot tell you which texel is wrong. So: pull the live
// texture out of the scene, blit it at 14x with image-rendering:pixelated, and
// also print a character map so the numbers are in the log rather than in my
// eye.
//
// The texture is found by SHAPE, not by name — a 38x38 canvas whose mesh has no
// `o.lit` registration — because nothing publishes the umbrellas and grepping
// for a material name would be a second copy of a fact crowd.ts owns.
//
//   SHOT_URL=http://localhost:4661/ TAG=before node scripts/probes/w110-umbrella-sheet.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4661/');
const TAG = process.env.TAG ?? 'now';
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 620 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.scene !== undefined, { timeout: 30000 });
await p.evaluate(() => window.__ct.warp(6.3, -60, Math.PI));
await p.waitForTimeout(1200);

const r = await p.evaluate(() => {
  // FOUND BY SHAPE, AND THE FIRST FILTER WAS TOO LOOSE — "any 38x38 map" matched
  // 17 meshes, and the one it handed back was an opaque noise tile with no
  // transparent texel in it. The umbrella is the only SQUARE PlaneGeometry
  // carrying a 38x38 map that is mostly transparent (it is a dome on a stick in
  // a square sheet), so all three conditions are required.
  const found = [];
  window.__ct.scene().traverse((o) => {
    const img = o.material && o.material.map && o.material.map.image;
    const g = o.geometry && o.geometry.parameters;
    if (!img || img.width !== 38 || img.height !== 38) return;
    if (!g || g.width === undefined || g.width !== g.height) return;
    const c0 = document.createElement('canvas');
    c0.width = 38; c0.height = 38;
    const g0 = c0.getContext('2d', { willReadFrequently: true });
    g0.drawImage(img, 0, 0);
    const d0 = g0.getImageData(0, 0, 38, 38).data;
    let clear = 0;
    for (let i = 3; i < d0.length; i += 4) if (d0[i] < 40) clear++;
    if (clear / (38 * 38) > 0.25) found.push({ o, clear });
  });
  if (!found.length) return { n: 0 };
  const img = found[0].o.material.map.image;
  const c = document.createElement('canvas');
  c.width = 38; c.height = 38;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, 38, 38).data;
  const rows = [];
  const tally = {};
  for (let y = 0; y < 38; y++) {
    let s = '';
    for (let x = 0; x < 38; x++) {
      const i = (y * 38 + x) * 4;
      const [R, G, B, A] = [d[i], d[i + 1], d[i + 2], d[i + 3]];
      let ch;
      if (A < 40) ch = '.';
      else {
        const key = `${R},${G},${B}`;
        tally[key] = (tally[key] || 0) + 1;
        ch = '#';
        if (R > 200 && G > 200 && B > 200) ch = '+';       // sky highlight
        else if (Math.abs(R - 74) < 12 && Math.abs(G - 74) < 12 && Math.abs(B - 82) < 12) ch = '|';  // ferrule/shaft
        else if (R > 70 && G < 70 && B < 55) ch = 'w';     // wood crook
        else if (R + G + B < 120) ch = 'r';                // rib shadow
      }
      s += ch;
    }
    rows.push(s);
  }
  // show it big, on top of everything, and screenshot that
  const view = document.createElement('canvas');
  view.width = 38 * 14; view.height = 38 * 14;
  view.style.cssText = 'position:fixed;left:20px;top:20px;z-index:9999;image-rendering:pixelated;'
    + 'background:#7d8a99;outline:2px solid #fff;';
  const vg = view.getContext('2d');
  vg.imageSmoothingEnabled = false;
  vg.drawImage(img, 0, 0, 38, 38, 0, 0, 38 * 14, 38 * 14);
  document.body.appendChild(view);
  return { n: found.length, rows, tally, opaque: Object.values(tally).reduce((a, c2) => a + c2, 0) };
});

if (!r.n) { console.log('REFUSING TO REPORT: no 38x38 umbrella texture in the scene'); await b.close(); process.exit(3); }
console.log(`umbrella meshes with a 38x38 sheet: ${r.n}\n`);
r.rows.forEach((s, y) => console.log(String(y).padStart(2), s));
console.log('\n  . transparent   # canopy   r rib shadow   + crown highlight   | shaft/ferrule   w wood crook');
const counts = {};
for (const row of r.rows) for (const ch of row) counts[ch] = (counts[ch] || 0) + 1;
console.log('texel counts:', JSON.stringify(counts));
await p.screenshot({ path: `shots/w110-umb-sheet-${TAG}.png` });
console.log(`-> shots/w110-umb-sheet-${TAG}.png`);
await b.close();
