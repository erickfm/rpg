// THE DINER'S GLASS BLOCK MUST NOT BE BRIGHTER THAN THE SKY.
//
// An ASSERTION, and it exits non-zero. It exists because I got this wrong by
// reasoning and would have shipped it: the panel was #b9c4c2, and on a street
// whose whole palette is muted 1997 it was the brightest surface in the world
// — a lit slab where a translucent one belongs. Walking up the block it read
// as a blank white wall, which is what the user was looking at when they said
// the diner "looks really bad".
//
// The trap, and the reason this is a script rather than a chosen constant:
// the base fill is NOT the tone you see. A per-cell white highlight and a
// room-glow gradient sit on top of it, and together they lift the modal tone
// by about eighteen. I picked a base at luma 151 against a sky I had assumed
// was 163, called it "12 below the sky", and measured 169 against 149. Both
// halves of that comparison were wrong in the same direction. GOTCHAS 29 —
// say which number you mean, and measure it rather than remember it.
//
// NOT REGISTERED IN scripts/checks.mjs AND NO SELFTEST YET, for the same
// reason as A-diner-door-aligns: the mutation belongs with the next change to
// this painter. Evidence, not a standing guard.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4188/';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(13, 30));
await p.waitForTimeout(900);

const r = await p.evaluate(() => {
  const enc = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
  const lum8 = (R, G, B) => Math.round(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const sky = window.__ct.scene().background;
  const skyLuma = lum8(...[sky.r, sky.g, sky.b].map((v) => Math.round(Math.min(1, Math.max(0, enc(v))) * 255)));
  const f = (globalThis.__frontages || []).find((q) => q.name === 'DINER');
  if (!f) return { err: 'no DINER frontage' };
  const scene = window.__ct.scene();
  scene.updateMatrixWorld(true);
  const lo = Math.min(f.loWorld, f.hiWorld), hi = Math.max(f.loWorld, f.hiWorld);
  const WANT = f.frontageM / 4.2;
  let img = null, best = 0.12;
  scene.traverse((n) => {
    if (!n.isMesh || !Array.isArray(n.material)) return;
    const e = n.matrixWorld.elements;
    if (e[14] < lo || e[14] > hi || e[13] < 1.4 || e[13] > 2.8) return;
    for (const m of n.material) {
      const im = m && m.map && m.map.image;
      if (!im || im.width < 100) continue;
      const err = Math.abs(im.width / im.height - WANT) / WANT;
      if (err < best) { best = err; img = im; }
    }
  });
  if (!img) return { err: 'no DINER band canvas' };
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const cx = c.getContext('2d');
  cx.drawImage(img, 0, 0);
  const d = cx.getImageData(0, 0, c.width, c.height).data;
  const ppm = c.width / f.frontageM;
  // Sample the block by asking WHERE IT IS rather than assuming an end: it is
  // whichever side of the frontage the published glazing span is not.
  const gLoU = Math.min(f.frontageM - (f.hiWorld - f.glazingLoWorld), f.hiWorld - f.glazingHiWorld);
  const gHiU = Math.max(f.hiWorld - f.glazingLoWorld, f.hiWorld - f.glazingHiWorld);
  const blockLow = gLoU > 0.9;
  const u0 = blockLow ? 0.6 : Math.min(gHiU + 0.4, f.frontageM - 2.2);
  const u1 = blockLow ? gLoU - 0.15 : f.frontageM - 0.6;
  const y = Math.round(c.height - 1.6 * ppm);
  const h = new Map();
  for (let x = Math.round(u0 * ppm); x < Math.round(u1 * ppm); x++) {
    const i = (y * c.width + x) * 4;
    const k = `${d[i]},${d[i + 1]},${d[i + 2]}`;
    h.set(k, (h.get(k) || 0) + 1);
  }
  if (!h.size) return { err: 'no block span found', u0, u1 };
  const entries = [...h.entries()].sort((a, z) => z[1] - a[1]);
  const modal = entries[0][0].split(',').map(Number);
  const px = [...h.values()].reduce((a, z) => a + z, 0);
  return { skyLuma, blockRGB: modal, blockLuma: lum8(...modal), span: [+u0.toFixed(2), +u1.toFixed(2)], px };
});
await b.close();

if (r.err) { console.error('ABORT:', r.err, JSON.stringify(r)); process.exit(3); }
// GOTCHAS 34: assert the population before the absence. A zero-pixel sample
// would make any brightness claim below true for free.
if (r.px < 20) { console.error(`ABORT: only ${r.px} px of block sampled`); process.exit(3); }

console.log(`\n  sky    luma ${r.skyLuma}`);
console.log(`  block  rgb(${r.blockRGB})  luma ${r.blockLuma}   (modal over u ${r.span[0]}-${r.span[1]} m, ${r.px} px)\n`);
if (r.blockLuma >= r.skyLuma) {
  console.error(`FAIL: the glass block is ${r.blockLuma - r.skyLuma} brighter than the sky. `
    + 'It reads as a lit slab, not as glass.');
  process.exit(1);
}
console.log(`OK  the block is ${r.skyLuma - r.blockLuma} darker than the sky.`);
