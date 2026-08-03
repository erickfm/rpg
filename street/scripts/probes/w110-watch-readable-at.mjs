// AT WHAT PITCH DOES THE WATCH BECOME *READABLE* — not "shown".
//
// The user: "to look at your watch you need to look straight down (couple deg
// of tolerance)." The gate says -0.95 rad (54.4 deg) and the clamp says -1.3
// (74.5), so on paper he has 20 degrees. This measures the thing he actually
// experiences: how much of the LCD is INSIDE THE VIEWPORT at each pitch, and
// whether the digits are on screen at all.
//
// Two measurements per pitch, both taken off the LIVE element rather than
// argued from the CSS:
//   · the wrapper's client rect (getBoundingClientRect of the rotated element)
//   · the LCD quad, mapped from CANVAS coordinates through the element's own
//     transform matrix, so the rotation and the drop are applied by the browser
//     and not retyped here. The LCD is canvas (WATCH_ARM+38, 21)..(+82, 44)
//     and the digits' baseline is (WATCH_ARM+60, 38) — ct/hud.ts drawWatch.
//
//   SHOT_URL=http://localhost:4661/ node scripts/probes/w110-watch-readable-at.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4661/');
const VW = Number(process.env.VW ?? 1280);
const VH = Number(process.env.VH ?? 958);
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: VW, height: VH } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.warp !== undefined, { timeout: 30000 });
await p.waitForTimeout(900);

// OUT OF THE APARTMENT (GOTCHAS 79b) — the HUD does not care, but a frame a
// human is asked to LOOK at should be the street he is playing.
await p.evaluate(() => window.__ct.warp(1.5, -70, 0, 0));
await p.evaluate(() => window.__ct.clock(14, 37));
await p.waitForTimeout(1400);

const measure = async (pitchRad) => {
  await p.evaluate((pr) => window.__ct.warp(
    window.__ct ? undefined : 0, undefined, undefined, undefined, pr), pitchRad)
    .catch(() => {});
  return null;
};
void measure;

const probe = await p.evaluate(async () => {
  const w = document.getElementById('ct-watch');
  const cv = w?.firstChild;
  return { present: !!w, cvW: cv?.width ?? 0, cvH: cv?.height ?? 0,
    cssW: cv?.style.width, cssH: cv?.style.height, wrap: w?.style.cssText ?? '' };
});

const rows = [];
for (const deg of [40, 45, 50, 52, 54, 54.4, 55, 56, 58, 60, 63, 66, 70, 74, 74.5]) {
  const rad = -deg * Math.PI / 180;
  await p.evaluate((r) => {
    const c = window.__ct.clockNow();
    void c;
    window.__ct.warp(1.5, -70, 0, 0, r);
  }, rad);
  // the CSS transition is .18s ease-out; give it four times that so a rect is
  // the settled rect and not a frame of the slide
  await p.waitForTimeout(750);
  const m = await p.evaluate(() => {
    const w = document.getElementById('ct-watch');
    const cv = w.firstChild;
    const S = parseFloat(cv.style.width) / cv.width;   // CSS px per canvas px
    const ARM = cv.width - 176;                         // WATCH_W - WATCH_HAND
    const r = w.getBoundingClientRect();
    // map canvas points through the element's real transform
    const mtx = new DOMMatrix(getComputedStyle(w).transform);
    const orig = w.getBoundingClientRect();
    void orig;
    // untransformed box of the element in page coords: use offset geometry
    const ux = w.offsetLeft, uy = w.offsetTop;
    const to = (cxp, cyp) => {
      const pt = mtx.transformPoint(new DOMPoint(cxp * S - w.offsetWidth * 0.5, cyp * S - w.offsetHeight * 0.5));
      return { x: pt.x + ux + w.offsetWidth * 0.5, y: pt.y + uy + w.offsetHeight * 0.5 };
    };
    const corners = [[ARM + 38, 21], [ARM + 82, 21], [ARM + 82, 44], [ARM + 38, 44]].map(([a, c]) => to(a, c));
    const digits = to(ARM + 60, 38 - 7);      // top of the digit glyphs
    const lcdTop = Math.min(...corners.map((c) => c.y));
    const lcdBot = Math.max(...corners.map((c) => c.y));
    const vis = Math.max(0, Math.min(innerHeight, lcdBot) - Math.max(0, lcdTop));
    return {
      pitch: window.__ct.pitch ? window.__ct.pitch() : null,
      rectTop: +r.top.toFixed(1), rectBot: +r.bottom.toFixed(1),
      rectLeft: +r.left.toFixed(1), rectRight: +r.right.toFixed(1),
      transform: getComputedStyle(w).transform,
      lcdTop: +lcdTop.toFixed(1), lcdBot: +lcdBot.toFixed(1),
      lcdVisFrac: +(vis / (lcdBot - lcdTop)).toFixed(3),
      digitsY: +digits.y.toFixed(1), digitsOnScreen: digits.y < innerHeight,
      vh: innerHeight,
    };
  });
  rows.push({ deg, ...m });
  await p.screenshot({ path: `shots/w110-pitch-${String(deg).replace('.', 'p')}.png` });
}

console.log('element:', JSON.stringify(probe));
console.log('deg   transform                                 rectTop rectBot  lcdTop lcdBot visFrac digitsY on?');
for (const r of rows) {
  console.log(
    String(r.deg).padEnd(6),
    (r.transform ?? '').slice(0, 40).padEnd(42),
    String(r.rectTop).padStart(7), String(r.rectBot).padStart(7),
    String(r.lcdTop).padStart(7), String(r.lcdBot).padStart(6),
    String(r.lcdVisFrac).padStart(7), String(r.digitsY).padStart(7),
    r.digitsOnScreen ? 'yes' : 'NO');
}
console.log('viewport height', rows[0]?.vh, ' errors:', errs.length, errs.slice(0, 3));
await b.close();
