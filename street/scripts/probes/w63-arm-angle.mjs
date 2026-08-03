#!/usr/bin/env node
// ITEM 165: HOW MUCH OF THE FRAME IS ARM, AND AT WHAT ANGLE?
//
// *"too much arm here i think it shou;ld have a bit of a steeper angle maybe?"*
//
// The complaint is about APPARENT PROPORTION, so the honest instrument is the
// rendered frame — but "looks like a plank" has two numbers behind it and both
// can be read off that frame:
//
//   · how much of the BOTTOM EDGE of the screen the arm occupies. In the user's
//     screenshot it is essentially all of it, which is what "a full-width band"
//     means and what "too much arm" is about.
//   · the ANGLE its top edge makes with horizontal. That is the thing he asked
//     to change.
//
// THE WORLD IS HIDDEN FOR THE MEASUREMENT, not for the picture. The apartment
// floor is a brown very close to skin, so a colour test over the live frame
// would count floorboards as forearm — and this project has a documented family
// of instruments that measured the wrong thing confidently (GOTCHAS §58). With
// the renderer's canvas hidden, every non-black pixel is HUD and the count is
// exact. A second, ordinary screenshot is taken for LOOKING at.
//
//   SHOT_URL=http://localhost:4190/ node scripts/probes/w63-arm-angle.mjs <tag>
import { chromium } from 'playwright';
import { waitPainted, blackFraction } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('set SHOT_URL to YOUR OWN server'); process.exit(3); }
const TAG = process.argv[2] ?? 'now';
// the user's own frame is 1063 x 795 (4:3-ish); 1280 x 958 is the same shape at
// a size this suite already uses
const VW = Number(process.env.VW ?? 1280), VH = Number(process.env.VH ?? 958);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: VW, height: VH } });
page.on('pageerror', (e) => console.log('pageerror: ' + e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await page.evaluate(() => window.__ct.clock(13, 35));   // his screenshot reads 13:35

// The player spawns INSIDE 301 (GOTCHAS §51), which is the room in his shot —
// wood floor, the TV in the corner. The watch comes up when you LOOK DOWN
// (crosstown.ts, pitch < -0.95); his pitch is steeper than that, so -1.25 is
// the same posture.
await page.evaluate(() => {
  const p = window.__ct.pos();
  window.__ct.warp(p[0], p[2], 0, window.__ct.groundAt(p[0], p[2]), -1.25);
});
await page.waitForTimeout(900);
// ITEM 181: WAIT FOR A FRAME THE RENDERER DREW, not for rAF. This item is one
// of the two the desk named where LOOKING is the only proof available, so a
// black frame here would not be a missing measurement — it would be a wrong
// one, judged by eye and written into a handoff.
await waitPainted(page, { quiet: true });
const shotBuf = await page.screenshot({ path: `/tmp/w63-arm-${TAG}.png` });
const voidFrac = await blackFraction(page, shotBuf);
if (voidFrac > 0.9) {
  console.error(`\n  the frame is ${(voidFrac * 100).toFixed(1)}% black — that is the void, `
    + 'not the world. Nothing below describes anything.\n');
  process.exit(3);      // measured NOTHING, which is not the same as measured BAD
}

// ── now hide the world and measure what is left ───────────────────────────
await page.evaluate(() => {
  for (const c of document.querySelectorAll('canvas')) {
    if (!c.closest('#ct-watch')) c.style.visibility = 'hidden';
  }
  const n = document.getElementById('ct-night'); if (n) n.style.display = 'none';
  document.documentElement.style.background = '#000';
  document.body.style.background = '#000';
});
await page.waitForTimeout(250);
await page.screenshot({ path: `/tmp/w63-arm-${TAG}-mask.png` });

const m = await page.evaluate(({ VW, VH }) => {
  const wrap = document.getElementById('ct-watch');
  const r = wrap.getBoundingClientRect();
  return {
    wrap: { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) },
    transform: getComputedStyle(wrap).transform,
    origin: getComputedStyle(wrap).transformOrigin,
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    VW, VH,
  };
}, { VW, VH });

// read the mask back through a canvas in the page — no image library needed
const shot = await page.screenshot();
const stats = await page.evaluate(async (b64) => {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const lit = (i) => d[i] > 24 || d[i + 1] > 24 || d[i + 2] > 24;   // anything not the black page
  // the bottom edge: how much of it is arm?
  let bottom = 0;
  const by = c.height - 1;
  for (let x = 0; x < c.width; x++) if (lit((by * c.width + x) * 4)) bottom++;
  // the top edge of the arm, column by column
  const topAt = new Array(c.width).fill(-1);
  let area = 0;
  for (let x = 0; x < c.width; x++) {
    for (let y = 0; y < c.height; y++) {
      const i = (y * c.width + x) * 4;
      if (lit(i)) { if (topAt[x] < 0) topAt[x] = y; area++; }
    }
  }
  const left = topAt.findIndex((v) => v >= 0);
  const right = topAt.length - 1 - [...topAt].reverse().findIndex((v) => v >= 0);
  return {
    w: c.width, h: c.height,
    bottomEdgePct: +(100 * bottom / c.width).toFixed(1),
    areaPct: +(100 * area / (c.width * c.height)).toFixed(1),
    left, right,
    topAt: topAt.map((v, x) => ({ x, y: v })).filter((p) => p.y >= 0 && p.x % 64 === 0),
  };
}, shot.toString('base64'));

// The angle of the arm's top edge, measured over the part of it a player can
// actually see: from the left of the frame to 200 px short of the watch.
const pts = stats.topAt.filter((p) => p.x >= stats.left && p.x <= Math.min(stats.right, stats.w - 420));
let angle = null;
if (pts.length >= 2) {
  const a = pts[0], b = pts[pts.length - 1];
  angle = +(Math.atan2(a.y - b.y, b.x - a.x) * 180 / Math.PI).toFixed(2);
}

console.log(`\n  w63 arm  [${TAG}]   viewport ${stats.w} x ${stats.h}`);
console.log(`  wrap        ${JSON.stringify(m.wrap)}`);
console.log(`  transform   ${m.transform}`);
console.log(`  origin      ${m.origin}`);
console.log(`  scrollW/clientW  ${m.scrollW}/${m.clientW}  ${m.scrollW === m.clientW ? 'no sideways scroll' : 'SCROLLBAR!'}`);
console.log('');
console.log(`  BOTTOM EDGE COVERED   ${stats.bottomEdgePct}%   <- "a full-width band" is ~100`);
console.log(`  HUD AREA OF FRAME     ${stats.areaPct}%`);
console.log(`  TOP-EDGE ANGLE        ${angle}°  (rise toward the watch, over the visible run)`);
console.log(`  spans x ${stats.left} .. ${stats.right}`);
console.log('  top edge, every 64 px:');
console.log('   ' + stats.topAt.map((p) => `${p.x}:${p.y}`).join('  '));
console.log(`\n  frames: /tmp/w63-arm-${TAG}.png  and  -mask.png\n`);
await browser.close();
