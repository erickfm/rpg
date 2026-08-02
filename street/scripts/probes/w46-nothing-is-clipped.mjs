// ITEM 97 — THE CHECK THAT CAN FAIL.
//
// "SEVENS reads in full" is the done-when line, and an advance-width sum is not
// proof of it: it re-derives what the painter was ASKED to do, not what landed
// on the canvas. This reads the finished texture instead.
//
// A string that overflows its canvas leaves ink in the edge column — that is
// what clipping IS — so the test is: no lit texel in column 0 or column W-1
// inside the rows the lettering occupies. It fails on the old facade and passes
// on this one, which is the only property that makes it worth committing.
//
// Textures are found by their canvas size in the live scene, never by name.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4180/';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(2000);

const r = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const seen = new Map();
  s.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      const im = m && m.map && m.map.image;
      if (im && im.getContext) seen.set(`${im.width}x${im.height}`, im);
    }
  });
  // the SEVENS name panel is the block-density masonry skin; the marquee fascia
  // is the only wide, short canvas on the frontage
  const pick = (pred) => { for (const [k, im] of seen) if (pred(im)) return [k, im]; return [null, null]; };
  const out = [];
  const scan = (label, im, y0f, y1f) => {
    if (!im) { out.push({ label, err: 'canvas not found' }); return; }
    const W = im.width, H = im.height;
    const d = im.getContext('2d').getImageData(0, 0, W, H).data;
    const lum = (x, y) => { const i = (y * W + x) * 4; return 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; };
    const y0 = Math.round(H * y0f), y1 = Math.round(H * y1f);
    // "lit" = brighter than any of this world's sign backgrounds (maroon skin
    // #6e1a24 lum 52, inset #12060a lum 8, fascia #1a1620 lum 24). 110 sits well
    // above all three and well below the gold core #f7e6b0 (lum 226).
    let edge = 0, inkMin = W, inkMax = -1;
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < W; x++) {
        if (lum(x, y) < 110) continue;
        if (x < inkMin) inkMin = x;
        if (x > inkMax) inkMax = x;
        if (x === 0 || x === W - 1) edge++;
      }
    }
    out.push({ label, W, H, rows: `${y0}..${y1}`, inkMin, inkMax,
      leftMargin: inkMin, rightMargin: W - 1 - inkMax, edge });
  };
  // 92x103 is the masonry skin at the block's 8 px/m over the 11.55 x 12.85 m
  // elevation; 192x52 is the marquee fascia at 32 px/m over 6.0 x 1.65 m. Sized,
  // not named, because nothing in this scene of 3000+ objects is named — but
  // sized EXACTLY, since a loose predicate matched a 768x10 strip from somewhere
  // else entirely and reported the casino clipped when it was not.
  const [, name] = pick((im) => im.width === 92 && im.height === 103);
  const [fk, fascia] = pick((im) => im.width === 192 && im.height === 52);
  scan('SEVENS  (name board)', name, 0.32, 0.68);
  scan('777     (mark band)', name, 0.72, 0.92);
  scan(`marquee line 1  [${fk}]`, fascia, 0.18, 0.55);
  scan(`marquee line 2  [${fk}]`, fascia, 0.60, 0.88);
  return out;
});

console.log('band                          canvas    rows      ink cols     margin L/R   texels in edge column');
let bad = 0;
for (const o of r) {
  if (o.err) { console.log(`${o.label.padEnd(28)}  ${o.err}`); bad++; continue; }
  const fail = o.edge > 0 || o.inkMax < 0;
  if (fail) bad++;
  console.log(`${o.label.padEnd(28)} ${(o.W + 'x' + o.H).padStart(8)} ${o.rows.padStart(9)} `
    + `${(o.inkMin + '..' + o.inkMax).padStart(11)} ${(o.leftMargin + '/' + o.rightMargin).padStart(11)}   `
    + `${String(o.edge).padStart(4)}  ${fail ? '** CLIPPED' : 'clear'}`);
}
console.log(bad === 0 ? '\nPASS — no lettering touches a canvas edge.'
  : `\nFAIL — ${bad} band(s) clipped.`);
await b.close();
process.exit(bad === 0 ? 0 : 1);
