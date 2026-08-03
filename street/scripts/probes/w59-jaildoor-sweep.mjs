// At what standoff does the jail door frame go black, and what is in front of
// the camera when it does? Run against the current build and the reverted one.
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const TAG = process.argv[2] || 'sweep';
const URL = process.env.SHOT_URL || 'http://localhost:4187/';
const DIR = 'shots/w59';
mkdirSync(DIR, { recursive: true });
const FACE_X = 61, CZ = -103, EAST = Math.PI / 2;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 750 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);

for (const d of [0.75, 1.0, 1.3, 1.6, 2.2]) {
  await p.evaluate(([a, c, y]) => window.__ct.warp(a, c, y, 0.14, 0), [FACE_X - d, CZ, EAST]);
  await p.evaluate(() => window.__ct.clock(13, 0));
  await p.waitForTimeout(900);
  const png = await p.screenshot();
  writeFileSync(`${DIR}/${TAG}-d${String(d).replace('.', '')}.png`, png);
  // how much of the frame is near-black? counted, not eyeballed
  const dark = await p.evaluate(() => {
    const c = document.querySelector('canvas');
    const g = document.createElement('canvas');
    g.width = c.width; g.height = c.height;
    // read straight off the WebGL canvas via drawImage — preserveDrawingBuffer
    // is what screenshot() relies on too, so if that works this does
    g.getContext('2d').drawImage(c, 0, 0);
    const d2 = g.getContext('2d').getImageData(0, 0, g.width, g.height).data;
    let n = 0;
    for (let i = 0; i < d2.length; i += 4) if (d2[i] < 12 && d2[i + 1] < 12 && d2[i + 2] < 12) n++;
    return { pct: (100 * n) / (d2.length / 4), w: g.width, h: g.height };
  });
  const hit = await p.evaluate(() => {
    const cam = window.__ct.camera();
    return { camPos: [cam.position.x, cam.position.y, cam.position.z], near: cam.near, far: cam.far };
  });
  console.log(`d=${d}  near-black ${dark.pct.toFixed(1)}%  cam ${hit.camPos.map((v) => v.toFixed(2)).join(',')} near=${hit.near} far=${hit.far}`);
}
console.log('console errors:', errs.length ? errs.slice(0, 5) : 'none');
await b.close();
