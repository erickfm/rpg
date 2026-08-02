// ITEM 97 — how wide is the INK of a bold monospace glyph, as a fraction of the
// font size? Needed to place letters on a pitch instead of on the natural
// advance: tightening the tracking is what lets SEVENS keep the 0.30 H cap
// height an earlier fix fought for AND still fit inside a 92-texel panel.
// Measured in the same engine that paints the texture, not assumed.
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('about:blank');
const r = await p.evaluate(() => {
  const c = document.createElement('canvas').getContext('2d');
  const out = [];
  for (const px of [8, 12, 21, 26, 31]) {
    c.font = `bold ${px}px monospace`;
    let maxInk = 0;
    for (const ch of 'SEVEN7CAIOU$') {
      const m = c.measureText(ch);
      maxInk = Math.max(maxInk, m.actualBoundingBoxLeft + m.actualBoundingBoxRight);
    }
    out.push({ px, adv: c.measureText('S').width, ink: maxInk,
      advF: c.measureText('S').width / px, inkF: maxInk / px });
  }
  return out;
});
console.log('px   advance  ink    advance/px  ink/px');
for (const o of r) console.log(`${String(o.px).padStart(2)}  ${o.adv.toFixed(2).padStart(7)} ${o.ink.toFixed(2).padStart(6)}   ${o.advF.toFixed(3).padStart(9)} ${o.inkF.toFixed(3).padStart(7)}`);
await b.close();
