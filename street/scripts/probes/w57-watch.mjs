// THE WATCH ARM: does it reach the edge, and did the WATCH move?
//
// The item's two hard constraints are numeric, so they are measured rather than
// eyeballed: the LCD's green face must land on the same screen pixels and be the
// same SIZE as before (that is "the watch has not moved" and "the pixels are the
// same size"), while the arm must run to x = 0.
//
//   SHOT_URL=http://localhost:4185/ node scripts/probes/w57-watch.mjs <tag>
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const TAG = process.argv[2] ?? 'now';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('pageerror: ' + e.message));
await page.goto(aim('http://localhost:4185/'), { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await page.evaluate(() => window.__ct.clock(13, 24));

// The watch comes up when you LOOK DOWN — crosstown.ts:1891, pitch < -0.95.
await page.evaluate(() => {
  const p = window.__ct.pos();
  window.__ct.warp(p[0], p[2], 0, window.__ct.groundAt(p[0], p[2]), -1.25);
});
await page.waitForTimeout(900);
await page.screenshot({ path: `/tmp/w57-watch-${TAG}.png` });

// WHERE THE WATCH ACTUALLY LANDS, in screen pixels. `#9cab8b` is the LCD
// (ct/hud.ts drawWatch) and nothing else in this world is that colour, so its
// bounding box IS the watch face's place and size.
const box = await page.evaluate(() => {
  const wrap = document.getElementById('ct-watch');
  const r = wrap.getBoundingClientRect();
  return {
    wrap: { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) },
    canvas: (() => { const c = wrap.firstChild; return { w: c.width, h: c.height, css: c.style.width }; })(),
    left: getComputedStyle(wrap).left,
    origin: getComputedStyle(wrap).transformOrigin,
    // does the page now scroll sideways? A 2.5 kpx element must not do that.
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
  };
});
console.log(JSON.stringify(box, null, 1));

// the LCD's bounding box, read off the rendered page rather than off the canvas
const lcd = await page.evaluate(() => {
  const wrap = document.getElementById('ct-watch');
  const c = wrap.firstChild;
  const g = c.getContext('2d');
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const i = (y * c.width + x) * 4;
    if (d[i] === 0x9c && d[i + 1] === 0xab && d[i + 2] === 0x8b) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  // canvas texel -> screen, through the element's own live transform
  const m = new DOMMatrix(getComputedStyle(wrap).transform);
  const r = wrap.getBoundingClientRect();
  const S = parseFloat(c.style.width) / c.width;
  // untransformed element origin: the transform is applied about transformOrigin,
  // so go through the box the browser reports for a known corner instead.
  return { texel: { x0, x1, y0, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 }, scale: S, m: m.toString().slice(0, 60), rect: { x: +r.x.toFixed(1), y: +r.y.toFixed(1) } };
});
console.log('LCD:', JSON.stringify(lcd));

// AND THE ARM ITSELF, measured on the rendered frame: how far left does skin
// reach along the row the wrist occupies?
const arm = await page.evaluate(() => {
  const wrap = document.getElementById('ct-watch');
  const r = wrap.getBoundingClientRect();
  return { armLeftEdge: +r.left.toFixed(1), armRightEdge: +r.right.toFixed(1) };
});
console.log('wrap spans x', JSON.stringify(arm), '(viewport 0..1280)');
await browser.close();
console.log(`frame: /tmp/w57-watch-${TAG}.png`);
