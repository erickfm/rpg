// WHERE IS THE LCD ON SCREEN, AND HOW MUCH OF IT DOES THE FRAME EAT?
//
// NOT from a hand-written rotation. A first cut of this measurement did the
// matrix by hand and reported the STOWED LCD as 99% on screen, which the
// screenshot flatly contradicts — so the browser does the transform now: a
// marker div is parented INSIDE the watch wrapper at the LCD's own canvas
// coordinates, and `getBoundingClientRect()` returns its real client box with
// the drop and the -18 deg rotation already applied.
//
// The LCD's canvas rect is ct/hud.ts drawWatch: fillRect(38, 21, 44, 23) after
// translate(WATCH_ARM, 0), and the 'CROSSTOWN QUARTZ' caption's baseline is at
// y 50 — cited, not guessed, because a second typed copy is BUILDER-BRIEF §8.
//
//   SHOT_URL=http://localhost:4661/ node scripts/probes/w110-lcd-pixels.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4661/');
mkdirSync('shots', { recursive: true });

export const lcdBox = (p) => p.evaluate(() => {
  const w = document.getElementById('ct-watch');
  const cv = w.firstChild;
  const S = parseFloat(cv.style.width) / cv.width;
  const ARM = cv.width - 176;                       // WATCH_W - WATCH_HAND
  const mark = (x, y, ww, hh) => {
    const d = document.createElement('div');
    d.style.cssText = `position:absolute;left:${(ARM + x) * S}px;top:${y * S}px;`
      + `width:${ww * S}px;height:${hh * S}px;pointer-events:none;`;
    w.appendChild(d);
    const r = d.getBoundingClientRect();
    d.remove();
    return { top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1),
      left: +r.left.toFixed(1), right: +r.right.toFixed(1) };
  };
  return {
    vh: innerHeight, vw: innerWidth, scale: S,
    lcd: mark(38, 21, 44, 23),          // the green face
    digits: mark(46, 27, 28, 14),       // 'HH:MM' at 14px bold, centred on x 60 y 38
    caption: mark(38, 45, 44, 7),       // 'CROSSTOWN QUARTZ', 5px, baseline y 50
    face: mark(32, 14, 56, 42),         // the case
    ty: new DOMMatrix(getComputedStyle(w).transform).f,
  };
});

if (import.meta.url === `file://${process.argv[1]}`) {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 958 } });
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__ct?.warp !== undefined, { timeout: 30000 });
  await p.evaluate(() => window.__ct.clock(14, 37));
  await p.evaluate(() => window.__ct.warp(1.5, -70, 0, 0, -1.1));
  await p.waitForTimeout(1200);
  const m = await lcdBox(p);
  const cut = (r) => Math.max(0, r.bottom - m.vh);
  console.log(`viewport ${m.vw}x${m.vh}  scale ${m.scale}  translateY ${m.ty.toFixed(1)}`);
  for (const k of ['face', 'lcd', 'digits', 'caption']) {
    const r = m[k];
    const h = r.bottom - r.top;
    console.log(`${k.padEnd(8)} y ${r.top.toFixed(1).padStart(7)}..${r.bottom.toFixed(1).padStart(7)}`
      + `  h ${h.toFixed(1).padStart(6)}  CUT ${cut(r).toFixed(1).padStart(6)} px`
      + `  (${(100 * Math.max(0, Math.min(m.vh, r.bottom) - r.top) / h).toFixed(1)}% on screen)`);
  }
  await p.screenshot({ path: 'shots/w110-lcd-now.png' });
  await b.close();
}
