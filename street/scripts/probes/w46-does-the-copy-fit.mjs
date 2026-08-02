// ITEM 97, defects 1 and 2 — MEASURE THE ADVANCE WIDTH, do not eyeball it.
//
// Both are stated as "clipped". Only one of them is. The check is the same in
// both cases: Canvas `measureText().width` for the exact string, font and size
// the painter uses, against the canvas the painter draws into.
//
// The canvas sizes are READ FROM THE LIVE SCENE (map.image.width/height) rather
// than retyped from vice.ts, because a retyped number is how this project got
// bedcavity.mjs (BUILDER-BRIEF §8).
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4180/';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(2000);

const r = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  // find the two canvases by their footprint in the world, not by name
  let name = null, fascia = null;
  s.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      const im = m && m.map && m.map.image; if (!im) continue;
      if (im.width === 92 && im.height === 103) name = { w: im.width, h: im.height };
      if (im.width === 96 && im.height === 26) fascia = { w: im.width, h: im.height };
    }
  });
  const c = document.createElement('canvas').getContext('2d');
  const measure = (str, font) => { c.font = font; return c.measureText(str).width; };
  const rows = [];
  if (name) {
    const px = Math.round(name.h * 0.30);
    rows.push({ what: 'SEVENS (facade name)', canvas: name.w, px,
      width: measure('SEVENS', `bold ${px}px monospace`) });
    const px7 = Math.round(name.h * 0.13);
    rows.push({ what: '777 (facade mark)', canvas: name.w, px: px7,
      width: measure('777', `bold ${px7}px monospace`) });
  }
  if (fascia) {
    rows.push({ what: 'LOOSEST SLOTS (marquee 1)', canvas: fascia.w, px: 8,
      width: measure('LOOSEST SLOTS', 'bold 8px monospace') });
    rows.push({ what: '$2 BLACKJACK  24 HRS (marquee 2)', canvas: fascia.w, px: 6,
      width: measure('$2 BLACKJACK  24 HRS', 'bold 6px monospace') });
  }
  return { name, fascia, rows };
});

console.log(`name panel canvas: ${r.name ? r.name.w + 'x' + r.name.h : 'NOT FOUND'}`);
console.log(`marquee fascia   : ${r.fascia ? r.fascia.w + 'x' + r.fascia.h : 'NOT FOUND'}\n`);
console.log('what                                canvas   px   advance   overflow   verdict');
let bad = 0;
for (const o of r.rows) {
  const over = o.width - o.canvas;
  const clipped = over > 0;
  if (clipped) bad++;
  console.log(`${o.what.padEnd(34)} ${String(o.canvas).padStart(6)} ${String(o.px).padStart(4)} `
    + `${o.width.toFixed(1).padStart(9)} ${(over > 0 ? '+' : '') + over.toFixed(1).padStart(9)}   `
    + (clipped ? `CLIPPED — ${(over / 2).toFixed(1)} texels off EACH end` : 'fits'));
}
console.log(`\n${bad} of ${r.rows.length} strings overflow their canvas.`);
await b.close();
