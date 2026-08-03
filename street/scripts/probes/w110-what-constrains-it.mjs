// WHAT ACTUALLY CONSTRAINS THE WATCH'S POSITION — the fist below and the HUD
// beside it. Before moving anything, find out (a) whether the fist really is
// cut by the bottom of the frame, which is the looked-at decision item 200
// settled, and (b) what else lives in the bottom band that a shallower gate
// would start covering.
//
// Every box is read from a marker div parented INSIDE the watch wrapper, so
// the browser applies the -18 deg rotation and the drop. Canvas coordinates
// are cited from ct/hud.ts drawWatch, not retyped from memory:
//   wrist  fillRect(0, 6, 104, 66)  after translate(WATCH_ARM, 0)
//   fist   fillRect(104, 0, 72, 72)
//   case   fillRect(32, 14, 56, 42)
//
//   SHOT_URL=http://localhost:4661/ node scripts/probes/w110-what-constrains-it.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4661/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 958 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.warp !== undefined, { timeout: 30000 });
await p.evaluate(() => window.__ct.clock(14, 37));
await p.evaluate(() => window.__ct.warp(1.5, -70, 0, 0, -1.1));
await p.waitForTimeout(1200);

const m = await p.evaluate(() => {
  const w = document.getElementById('ct-watch');
  const cv = w.firstChild;
  const S = parseFloat(cv.style.width) / cv.width;
  const ARM = cv.width - 176;
  const box = (x, y, ww, hh) => {
    const d = document.createElement('div');
    d.style.cssText = `position:absolute;left:${(ARM + x) * S}px;top:${y * S}px;`
      + `width:${ww * S}px;height:${hh * S}px;pointer-events:none;`;
    w.appendChild(d); const r = d.getBoundingClientRect(); d.remove();
    return { t: +r.top.toFixed(1), b: +r.bottom.toFixed(1), l: +r.left.toFixed(1), r: +r.right.toFixed(1) };
  };
  // a 1px probe at a single canvas corner, so a CORNER is a corner and not a
  // rotated bounding box
  const pt = (x, y) => { const r = box(x, y, 1, 1); return { x: +((r.l + r.r) / 2).toFixed(1), y: +((r.t + r.b) / 2).toFixed(1) }; };
  const hud = [...document.querySelectorAll('body > div, body > *')]
    .filter((e) => e.id !== 'ct-watch' && e.tagName !== 'CANVAS' && e.tagName !== 'SCRIPT')
    .map((e) => { const r = e.getBoundingClientRect(); return { id: e.id || e.tagName, t: +r.top.toFixed(0), b: +r.bottom.toFixed(0), l: +r.left.toFixed(0), r: +r.right.toFixed(0), vis: getComputedStyle(e).visibility, disp: getComputedStyle(e).display, txt: (e.textContent || '').trim().slice(0, 40) }; })
    .filter((e) => e.b > 700);
  return { vh: innerHeight, S,
    fistBL: pt(104, 72), fistBR: pt(176, 72), fistTL: pt(104, 0), fistTR: pt(176, 0),
    wristBL: pt(0, 72), caseBL: pt(32, 56), caseBR: pt(88, 56), caseTL: pt(32, 14),
    hud };
});

console.log(`viewport height ${m.vh}, scale ${m.S}`);
for (const [k, v] of Object.entries(m)) {
  if (v && typeof v === 'object' && 'y' in v) {
    console.log(`${k.padEnd(8)} screen (${String(v.x).padStart(7)}, ${String(v.y).padStart(7)})  `
      + (v.y > m.vh ? `${(v.y - m.vh).toFixed(1)} px BELOW the frame` : `${(m.vh - v.y).toFixed(1)} px above the bottom`));
  }
}
console.log('\nother elements in the bottom band:');
for (const h of m.hud) console.log(' ', JSON.stringify(h));
await b.close();
