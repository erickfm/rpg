// PRINT THE CITIZEN SHEET THAT IS ACTUALLY ON THE MESH, at 6x. Item 278.
//
// A 32 x 64 figure seen at 4 m is about 60 screen pixels tall, and an arm is
// three texels of it. That is enough to judge the SILHOUETTE and not nearly
// enough to judge whether the limb is drawn correctly — so the sheet itself is
// the diagnostic and the street frame is the verdict. (Item 271 made the same
// split: `w110-umbrella-sheet.mjs` printed the umbrella's texels while
// `w110-umbrella-look.mjs` judged the street.)
//
// THE LIVE MAP, not `__ct.crowd.atlases()`. That accessor returns `c.tex`, the
// arms-down bake, always — so a probe that used it would photograph the sheet
// the mesh is NOT wearing and report confidently about it.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { goto } from '../lib/reachable.mjs';
import { waitPainted } from '../lib/painted.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const URL = aim('http://localhost:4188/');
const WET = process.env.WET !== '0';
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage();
await goto(p, URL);
await p.waitForFunction(() => window.__ct?.walkers !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.warp(6.3, -60, Math.PI));
await waitPainted(p, { frames: 10 });

if (WET) {
  let found = false;
  for (let h = 8; h <= 18 && !found; h++) {
    await p.evaluate((hh) => window.__ct.clock(hh, 0), h);
    for (let t = 0; t < 12 && !found; t++) {
      await waitPainted(p, { frames: 8 });
      found = await p.evaluate(() => window.__ct.walkers().some((q) => q.holding));
    }
  }
  if (!found) { console.log('REFUSING TO REPORT: nobody is holding anything'); await b.close(); process.exit(3); }
}

const png = await p.evaluate(([scale, wet]) => {
  // ⚠ NOT "the first 160x128 sheet in the scene". The interiors and the hermit
  // paint citizens too and their sheets are the same size, so the first match
  // is very often somebody standing in a shop — and the first run of this probe
  // photographed exactly that and showed both arms hanging while six walkers on
  // the street had their hands up. A probe that answers confidently about the
  // wrong object is the failure this project keeps paying for (item 271's own
  // note says so about its umbrella finder).
  //
  // So: find the mesh standing where a HOLDING walker is standing.
  const want = window.__ct.walkers().filter((q) => (wet ? q.holding : !q.holding));
  if (!want.length) return null;
  let src = null, best = 1e9;
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.material?.map) return;
    const im = o.material.map.image;
    if (!im || im.width !== 160 || im.height !== 128) return;
    for (const q of want) {
      const d = Math.hypot(o.position.x - q.x, o.position.z - q.z);
      if (d < best && d < 0.35) { best = d; src = im; }
    }
  });
  if (!src) return null;
  const cv = document.createElement('canvas');
  cv.width = src.width * scale; cv.height = src.height * scale;
  const g = cv.getContext('2d');
  // a chequer behind it, so transparent texels are visibly transparent rather
  // than reading as black paint
  for (let y = 0; y < cv.height; y += 8) for (let x = 0; x < cv.width; x += 8) {
    g.fillStyle = ((x / 8 + y / 8) % 2) ? '#d8d8d8' : '#f0f0f0';
    g.fillRect(x, y, 8, 8);
  }
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, cv.width, cv.height);
  return cv.toDataURL().split(',')[1];
}, [6, WET]);
if (!png) { console.log('NO 160x128 CITIZEN SHEET FOUND ON ANY MESH'); await b.close(); process.exit(3); }
const path = `shots/w107-sheet-${WET ? 'holding' : 'hanging'}.png`;
writeFileSync(path, Buffer.from(png, 'base64'));
console.log(`${path}  (160x128 at 6x; 5 views across, 2 frames down)`);
await b.close();
