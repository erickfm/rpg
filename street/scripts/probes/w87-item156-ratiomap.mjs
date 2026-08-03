// ITEM 156 — RENDER THE LIGHTING FIELD ITSELF, at one station.
//
// `w87-item156-lightedge.mjs` found the station (z -50 looking east, edge 0.303
// at S/N 10.1). This draws the thing that measurement is a summary of: for every
// pixel, night/day, which is the lighting multiplier with the texture divided
// out. Grey = unlit night floor, white = fully lit. Masonry, signs and window
// reveals vanish because they are in both frames; only the LIGHT is left.
//
// Output is written back into the page as a canvas and screenshotted, because
// this repo has no PNG encoder.
//
//   SHOT_URL=http://localhost:4430/ node scripts/probes/w87-item156-ratiomap.mjs [z] [side]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { waitPainted } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL || 'http://localhost:4430/';
const Z = Number(process.argv[2] ?? -50);
const SIDE = process.argv[3] ?? 'e';
mkdirSync('shots', { recursive: true });
const W = 1000, H = 640;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: W, height: H } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await waitPainted(p);
const x = SIDE === 'e' ? -2.0 : 2.0, yaw = SIDE === 'e' ? Math.PI / 2 : -Math.PI / 2;
await p.evaluate(([X, ZZ, Y]) => window.__ct.warp(X, ZZ, Y, 0, 0.08), [x, Z, yaw]);
await p.waitForTimeout(250);

const grab = () => p.evaluate(([w, h]) => {
  const c = document.querySelector('canvas');
  const g = document.createElement('canvas'); g.width = w; g.height = h;
  const cx = g.getContext('2d', { willReadFrequently: true });
  cx.drawImage(c, 0, 0, w, h);
  return Array.from(cx.getImageData(0, 0, w, h).data);
}, [W, H]);

await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(450); await waitPainted(p);
const day = await grab();
await p.evaluate(() => window.__ct.clock(23, 0));
await p.waitForTimeout(450); await waitPainted(p);
await p.screenshot({ path: `shots/w87-156-map-z${String(Z).replace('-', 'm')}${SIDE}-night.png` });
const night = await grab();

// paint the ratio into a fresh canvas in the page, then shoot it
await p.evaluate(([d, n, w, h]) => {
  const g = document.createElement('canvas'); g.width = w; g.height = h;
  g.style.cssText = 'position:fixed;left:0;top:0;z-index:99999';
  const cx = g.getContext('2d');
  const img = cx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const j = i << 2;
    const dl = 0.2126 * d[j] + 0.7152 * d[j + 1] + 0.0722 * d[j + 2];
    const nl = 0.2126 * n[j] + 0.7152 * n[j + 1] + 0.0722 * n[j + 2];
    // too dark in DAY to divide safely -> flat blue, so it cannot be mistaken
    // for a measurement
    if (dl < 14) { img.data[j] = 30; img.data[j + 1] = 40; img.data[j + 2] = 90; img.data[j + 3] = 255; continue; }
    const r = Math.max(0, Math.min(1, nl / dl));
    const v = Math.round(255 * Math.pow(r, 0.6));
    img.data[j] = img.data[j + 1] = img.data[j + 2] = v; img.data[j + 3] = 255;
  }
  cx.putImageData(img, 0, 0);
  document.body.appendChild(g);
}, [day, night, W, H]);
await p.waitForTimeout(200);
await p.screenshot({ path: `shots/w87-156-map-z${String(Z).replace('-', 'm')}${SIDE}-ratio.png` });
console.log(`  shots/w87-156-map-z${String(Z).replace('-', 'm')}${SIDE}-ratio.png   (night/day, texture divided out)`);
await b.close();
