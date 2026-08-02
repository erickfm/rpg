// THE CEILING OVER THE LIBRARY DOORS IS NOT A FLAT COLOUR.
//
// STATION: (-8.6, -13.0) on the forecourt facing the doors, pitched up — the
// spot a player stands on to press E. The mass that bridges the entrance recess
// puts its -y face about three metres over your head there, and it was one flat
// `#2b2d33`, reading as a black trapezoid capping the entrance.
//
// WHAT THIS ASSERTS, and why it is this and not "the material has a map":
// a map proves the code changed, not that anything is visible. B's whole
// argument for these helpers is that a flat quad gives the eye no grain to
// attach to and therefore no scale — so the thing to measure is GRAIN IN THE
// RENDERED FRAME, off the composited PNG, in the band of screen the soffit
// occupies from that station.
//
//   SHOT_URL=http://localhost:4182/ node scripts/E-soffit-has-grain.mjs
//
// `E_FLAT=1` is the positive control: it counts the same band on a synthetic
// flat fill instead of the frame, and MUST come back red. A grain check that
// has never been shown to fail is one you will argue with.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { reportWorld } from '../lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4182/';
mkdirSync('shots/E-soffit', { recursive: true });

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1000, height: 640 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);
await page.evaluate(() => window.__ct.clock(13, 20));
// ARRIVE BEFORE YOU MEASURE, and prove you arrived.
//
// With a flat 900 ms settle this read 1 tone / 0.0% on one run in three — the
// flat-fill signature — and PASSED the other two. It was not measuring a flat
// soffit; it was measuring SKY, because the warp had not been reflected in the
// frame that got captured and the top 9% of a frame from anywhere else is one
// uniform tone.
//
// That is the worst possible failure for this particular check: the fault it
// reports and the fault it suffers produce THE SAME NUMBER. A run that has
// wandered off looks exactly like a flat quad. So poll until the player is
// actually at the station, then let a few frames go by.
const STATION = { x: -8.6, z: -13.0 };
await page.evaluate(([x, z]) => window.__ct.warp(x, z, -Math.PI / 2, 0.14, 0.22), [STATION.x, STATION.z]);
const arrived = await page.evaluate(([x, z]) => new Promise((res) => {
  const t0 = performance.now();
  const tick = () => {
    const p = window.__ct.pos();
    if (Math.hypot(p[0] - x, p[2] - z) < 0.15) return res(true);
    if (performance.now() - t0 > 10000) return res(false);
    requestAnimationFrame(tick);
  };
  tick();
}), [STATION.x, STATION.z]);
if (!arrived) {
  const p = await page.evaluate(() => window.__ct.pos());
  console.log(`\nEXIT 3: never reached the station — stuck at (${p[0].toFixed(2)}, ${p[2].toFixed(2)}).`);
  console.log('Nothing was measured, so this says nothing about the soffit. GOTCHAS 32.');
  await b.close();
  process.exit(3);
}
await page.waitForTimeout(700);          // let the frame after the move land
// Captured to a buffer first and only WRITTEN if it drew. The dead-capture
// runs above overwrote a good frame with a black one, which is the evidence
// this row rests on — a failed run must not destroy the artefact of a passing
// one. Dead frames still get kept, under their own name, because "what did the
// machine give me" is worth being able to look at.
const png = await page.screenshot();

// the soffit fills the top ~9% of frame from this station. Count distinct
// coarse colours and the fraction of neighbouring pixels that differ at all —
// a flat fill scores 1 and 0.
const m = await page.evaluate(async ([b64, flatControl]) => {
  const img = new Image();
  img.src = `data:image/png;base64,${b64}`;
  await img.decode();
  const W = 200, H = 40;
  const g = document.createElement('canvas');
  g.width = W; g.height = H;
  const x = g.getContext('2d');
  if (flatControl) { x.fillStyle = '#2b2d33'; x.fillRect(0, 0, W, H); }
  else x.drawImage(img, 0, 0, img.width, Math.floor(img.height * 0.09), 0, 0, W, H);
  const d = x.getImageData(0, 0, W, H).data;
  const at = (px, py) => { const i = (py * W + px) * 4; return (d[i] + d[i + 1] + d[i + 2]) / 3; };
  const seen = new Set();
  let diff = 0, n = 0;
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const i = (py * W + px) * 4;
      seen.add(`${d[i] >> 3},${d[i + 1] >> 3},${d[i + 2] >> 3}`);
      if (px + 1 < W) { n++; if (Math.abs(at(px, py) - at(px + 1, py)) > 1.2) diff++; }
    }
  }
  // …AND THE REST OF THE FRAME, which is how a dead capture is told from a flat
  // soffit. Under load this world renders wholly black frames, and a black
  // frame scores 1 tone / 0% in the soffit band — THE SAME NUMBERS AS THE FAULT
  // THIS CHECK LOOKS FOR. Five runs in a row reported "the soffit is flat"
  // about frames in which nothing had drawn at all.
  //
  // The two are separable, and only by looking wider: a flat soffit is flat in
  // the top band ONLY, with the lit doors and stonework beneath it. A dead
  // frame is flat everywhere. So measure the whole frame as well and let the
  // check say "I cannot answer" instead of "the soffit is broken".
  const g2 = document.createElement('canvas');
  g2.width = 120; g2.height = 76;
  const x2 = g2.getContext('2d');
  if (flatControl) { x2.fillStyle = '#2b2d33'; x2.fillRect(0, 0, 120, 76); }
  else x2.drawImage(img, 0, 0, img.width, Math.floor(img.height * 0.82), 0, 0, 120, 76);
  const d2 = x2.getImageData(0, 0, 120, 76).data;
  const whole = new Set();
  for (let i = 0; i < d2.length; i += 4) whole.add(`${d2[i] >> 3},${d2[i + 1] >> 3},${d2[i + 2] >> 3}`);
  return { tones: seen.size, edge: +(diff / Math.max(n, 1)).toFixed(4), frameTones: whole.size };
}, [png.toString('base64'), !!process.env.E_FLAT]);

// The control paints a flat fill deliberately, so it is exempt: it is testing
// that a genuinely flat soffit goes red, not that the world drew.
if (!process.env.E_FLAT && m.frameTones < 6) {
  console.log(`\nEXIT 3: the whole frame is ${m.frameTones} tone(s) — nothing drew, this is a dead capture.`);
  console.log('Not a flat soffit: a flat soffit still has lit doors and stone beneath it.');
  console.log('The machine is loaded and the renderer produced a black frame. GOTCHAS 32.');
  writeFileSync('shots/E-soffit/DEAD-capture.png', png);
  await b.close();
  process.exit(3);
}

writeFileSync('shots/E-soffit/over-the-doors.png', png);
console.log(`station (-8.6, -13.0), the band the soffit fills: ${m.tones} tones, edge density ${(m.edge * 100).toFixed(1)}%`);
const ok = m.tones >= 3 && m.edge >= 0.03;
console.log(`${ok ? 'PASS' : 'FAIL'}  the ceiling over the doors carries grain, not one flat tone`);
if (!ok) console.log('      a flat quad scores 1 tone and 0% — this is the fault B named');
await b.close();
process.exit(ok ? 0 : 1);
