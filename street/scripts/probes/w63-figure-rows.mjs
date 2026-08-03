#!/usr/bin/env node
// ITEM 187, THE NUMBER THAT DECIDES THE RANGE: how tall is a person at hs = 1?
//
// The plane is 1.9 m tall (`citizenPlane`, H = 1.9) and it is NOT the person —
// four empty rows sit under the shoe and there is headroom above the hair. So
// "hs 0.86 … 1.15" says nothing about whether anybody looks child-sized until
// you know what fraction of the frame the painted figure actually occupies.
//
// I nearly picked the spread from the PLANE height and it would have put the
// shortest walker at about 1.43 m — a ten-year-old on the pavement, which is
// exactly what the row warns against. Measured instead: read the atlas back and
// find the opaque rows.
//
//   SHOT_URL=http://localhost:4191/ node scripts/probes/w63-figure-rows.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('set SHOT_URL to YOUR OWN server'); process.exit(3); }

const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__ct?.atlases !== undefined, { timeout: 20000 });

const r = await p.evaluate(async () => {
  const urls = window.__ct.atlases();
  const out = [];
  for (const u of urls) {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = u; });
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, 32, 64).data;   // the first 32 x 64 cell
    let top = -1, bot = -1;
    for (let y = 0; y < 64; y++) for (let x = 0; x < 32; x++) {
      if (d[(y * 32 + x) * 4 + 3] > 32) { if (top < 0) top = y; bot = y; }
    }
    out.push({ w: img.width, h: img.height, top, bot, rows: bot - top + 1 });
  }
  return out;
});

const scales = await p.evaluate(() => window.__ct.people().map((q) => +q.hs.toFixed(4)));
console.log('');
r.forEach((q, i) => {
  const at1 = q.rows * 1.9 / 64;
  console.log(`  cast ${i}  figure rows ${q.top}..${q.bot} = ${q.rows}/64  ->  `
    + `${at1.toFixed(3)} m at hs 1   ·   hs ${scales[i]}  ->  ${(at1 * scales[i]).toFixed(3)} m`);
});
// EACH CAST MEMBER'S OWN ROW COUNT, not cast 0's for everybody — they differ by
// a row (a hat, a hairstyle) and using one for all six put the shortest walker
// 26 mm out on the first version of this line.
const m = r.map((q, i) => q.rows * 1.9 / 64 * scales[i]);
console.log(`\n  shortest walker ${Math.min(...m).toFixed(3)} m   `
  + `tallest ${Math.max(...m).toFixed(3)} m   spread ${(Math.max(...m) - Math.min(...m)).toFixed(3)} m\n`);
await b.close();
