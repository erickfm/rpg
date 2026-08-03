// DID THE BOTTLE-GREEN SURVIVE THE PER-FACE REPEAT? — item 162, worker onehundredsix.
//
// `slabTex` fills the authored colour INTO the canvas, so the material reads
// `#ffffff` and no census can tell you the velvet is still green. Only pixels
// can. This shoots the lobby suite and the three mismatched chairs and reports
// the MEAN RGB of a centre patch, so a before/after can be compared as numbers
// rather than by eye alone — the eye still gets the PNG.
//
// Why numbers and not just a look: my change alters `repeat` only. The canvas is
// byte-identical (same base/ppm/grain/joint/wMeters/dMeters), so the mean colour
// of a pure-grain sheet MUST be unchanged to within sampling noise. If it moved,
// I broke something. That is a prediction the probe can falsify, which is the
// only kind worth making.
//
//   SHOT_URL=http://localhost:4620/ node scripts/probes/w106-hotel-fabric-look.mjs [tag]
//
// GOTCHAS 78/80: `waitPainted`, never `afterFrames` and never a bare sleep —
// this file's predecessor (`w96-hotel-suite-look.mjs`) uses `waitForTimeout(1400)`
// and can photograph a black frame under load.
// GOTCHAS 90: `groundAt` is ASYNC. `await` it or you warp to a Promise.
// GOTCHAS 86: ASK `roomDims()` where the room is — the hotel is at 874.32 in a
// slab centred on 840, because item 196's party wall shoved it to the boundary.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { waitPainted, blackFraction } from '../lib/painted.mjs';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4620/');
const TAG = process.argv[2] ?? 'after';
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.roomDims !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(13, 0));   // a game day is 24 REAL minutes

const room = await p.evaluate(() => window.__ct.roomDims().find((r) => r.id === 'hotel'));
if (!room) { console.log('REFUSING TO REPORT: no hotel room'); await b.close(); process.exit(3); }
console.log(`hotel cx=${room.cx} cz=${room.cz}`);

// Same two stations as w96 so the two probes' pictures are comparable.
const shots = [
  ['suite', room.cx + 2.4, 3.5, Math.PI / 2],
  ['chairs', room.cx + 1.0, room.cz + 26 / 2 - 6.2, Math.PI / 2],
];

let bad = 0;
for (const [tag, x, z, yaw] of shots) {
  await p.evaluate(async ([x2, z2, y2]) => {
    const gy = await window.__ct.groundAt(x2, z2);     // ASYNC — GOTCHAS 90
    window.__ct.warp(x2, z2, y2, gy, -0.12);
  }, [x, z, yaw]);
  const painted = await waitPainted(p, { frames: 3 });
  const path = `shots/w106-hotel-${tag}-${TAG}.png`;
  const buf = await p.screenshot({ path });
  const black = await blackFraction(p, buf);

  // Mean RGB of the centre patch — the furniture fills it at both stations.
  const mean = await p.evaluate(async (dataUrl) => {
    const img = new Image();
    await new Promise((r) => { img.onload = r; img.src = dataUrl; });
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    cv.getContext('2d').drawImage(img, 0, 0);
    const x0 = Math.floor(img.width * 0.30), y0 = Math.floor(img.height * 0.45);
    const w = Math.floor(img.width * 0.40), h = Math.floor(img.height * 0.35);
    const d = cv.getContext('2d').getImageData(x0, y0, w, h).data;
    let r = 0, g = 0, bl = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; bl += d[i + 2]; }
    const n = d.length / 4;
    return [+(r / n).toFixed(2), +(g / n).toFixed(2), +(bl / n).toFixed(2)];
  }, `data:image/png;base64,${buf.toString('base64')}`);

  const green = mean[1] > mean[0] && mean[1] > mean[2];
  console.log(`${tag}: mean RGB ${JSON.stringify(mean)}  green-dominant=${green}`
    + `  black=${(black * 100).toFixed(1)}%  frames=${painted.frames} tris=${painted.triangles}`
    + `  -> ${path}`);
  if (black > 0.98) { console.log(`  ${tag}: PHOTOGRAPHED THE VOID`); bad++; }
}
await b.close();
process.exit(bad ? 1 : 0);
