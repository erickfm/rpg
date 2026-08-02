// All EIGHT angles of a citizen, standing and walking, as they are actually
// drawn on screen — which is not the same as the five painted columns.
//
// ct/citizens.ts paints 5 views; `viewFor` maps the 8 facing sectors onto them
// and MIRRORS the back half:
//
//   sector 0 1 2 3 4 5 6 7
//   column 0 1 2 3 4 3 2 1
//   mirror . . . . . y y y
//
// So a fault in the profile column shows up twice, once flipped — and a fix
// judged on one of them can be wrong on the other. Both previous attempts at
// the profile feet were judged on a single angle. This lays all eight side by
// side, standing (frame 0) on the top row and walking (frame 1) below.
//
// Usage: SHOT_URL=http://localhost:4187/ node scripts/feet.mjs [personIndex]
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { writeFileSync } from 'node:fs';

// GOTCHAS 34, THE OTHER WAY UP. That rule is about an argument that makes a
// check run NOTHING and exit 0. This one made it run with NaN and exit 1: the
// window below is `Number(process.argv[2] ?? 0)`, and any non-numeric
// argument — `--slow`, a flag form half this suite takes — makes every
// measurement NaN and reports three failures about a world that is fine. A
// false red costs as much trust as a false green. Refuse instead.
if (process.argv[2] !== undefined && !Number.isFinite(Number(process.argv[2]))) {
  console.error(`INCONCLUSIVE — "${process.argv[2]}" is not a number of which citizen. ` +
    'This check takes one optional numeric argument; anything else would run every ' +
    'measurement against NaN and report failures about a sound world.');
  process.exit(2);
}
const who = Number(process.argv[2] ?? 0);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(aim('http://localhost:4177/'), { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(page, aim('http://localhost:4177/'));   // GOTCHAS 26: prove it, do not just name it
await page.waitForTimeout
  ? await page.waitForTimeout(500) : null;
await page.evaluate(() => window.__ct.clock(13, 0));

const png = await page.evaluate(async (who) => {
  const FW = 32, FH = 64, Z = 6;                 // sprite size, and the zoom
  const COLS = [0, 1, 2, 3, 4, 3, 2, 1];
  const MIRROR = [0, 0, 0, 0, 0, 1, 1, 1];
  const url = window.__ct.atlases()[who];
  const img = new Image();
  await new Promise((r) => { img.onload = r; img.src = url; });
  const PAD = 10, LABEL = 16;
  const cv = document.createElement('canvas');
  cv.width = PAD + 8 * (FW * Z + PAD);
  cv.height = LABEL + 2 * (FH * Z + PAD + LABEL);
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#5a6068'; g.fillRect(0, 0, cv.width, cv.height);
  g.font = '12px monospace'; g.textBaseline = 'top';
  for (let frame = 0; frame < 2; frame++) {
    const rowY = LABEL + frame * (FH * Z + PAD + LABEL);
    g.fillStyle = '#e8e4d8';
    g.fillText(frame === 0 ? 'frame 0 — STANDING (stride 0)' : 'frame 1 — WALKING (stride 2…5)', PAD, rowY - 14);
    for (let s = 0; s < 8; s++) {
      const col = COLS[s], mir = MIRROR[s];
      const x = PAD + s * (FW * Z + PAD);
      // a checker behind each cell so alpha (and stray translucent fills that
      // alphaTest would discard) are visible rather than blending into a flat
      for (let a = 0; a < FW * Z; a += 12) {
        for (let b = 0; b < FH * Z; b += 12) {
          g.fillStyle = ((a + b) / 12) % 2 ? '#4c5158' : '#565c64';
          g.fillRect(x + a, rowY, Math.min(12, FW * Z - a), Math.min(12, FH * Z - b));
        }
      }
      g.save();
      g.translate(x, rowY);
      if (mir) { g.translate(FW * Z, 0); g.scale(-1, 1); }
      g.drawImage(img, col * FW, frame * FH, FW, FH, 0, 0, FW * Z, FH * Z);
      g.restore();
      g.fillStyle = '#e8e4d8';
      g.fillText(`s${s} col${col}${mir ? ' MIR' : ''}`, x, rowY + FH * Z + 2);
      // and mark the sprite's centre line, so "is the toe forward of the
      // ankle" is answerable rather than eyeballed
      g.fillStyle = 'rgba(255,80,80,0.55)';
      g.fillRect(x + (FW / 2) * Z, rowY, 1, FH * Z);
    }
  }
  return cv.toDataURL();
}, who);

writeFileSync(`shots/feet-8way-${who}.png`, Buffer.from(png.split(',')[1], 'base64'));
console.log(`shots/feet-8way-${who}.png  — 8 angles x standing/walking, red line = sprite centre`);

// …and the numbers, so the shape is checked rather than admired
const geom = await page.evaluate(async (who) => {
  const FW = 32, FH = 64;
  const url = window.__ct.atlases()[who];
  const img = new Image();
  await new Promise((r) => { img.onload = r; img.src = url; });
  const cv = document.createElement('canvas');
  cv.width = img.width; cv.height = img.height;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const out = [];
  for (let frame = 0; frame < 2; frame++) {
    // the shoe rows are oy+57 … oy+59
    const y = frame * FH + 58;
    const d = g.getImageData(2 * FW, y, FW, 1).data;   // the PROFILE column
    let min = 99, max = -1;
    for (let x = 0; x < FW; x++) if (d[x * 4 + 3] > 127) { min = Math.min(min, x); max = Math.max(max, x); }
    // and the leg row, to check the ankle sits inside the foot
    const dl = g.getImageData(2 * FW, frame * FH + 45, FW, 1).data;
    const legs = [];
    for (let x = 0; x < FW; x++) {
      const on = dl[x * 4 + 3] > 127;
      if (on && !legs.length) legs.push(x);
      else if (on) legs[1] = x;
    }
    out.push({ frame, footFrom: min - FW / 2, footTo: max - FW / 2, legFrom: legs[0] - FW / 2, legTo: (legs[1] ?? legs[0]) - FW / 2 });
  }
  return out;
}, who);
console.log('\nprofile column, measured off the painted pixels (x relative to sprite centre):');
for (const r of geom) {
  console.log(`  frame ${r.frame}: foot spans ${r.footFrom} … ${r.footTo}` +
    ` (${r.footTo - r.footFrom + 1} texels)   legs span ${r.legFrom} … ${r.legTo}`);
}
await browser.close();
