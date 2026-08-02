// DOES slabTex TURN A FLAT COLOUR INTO A MATERIAL, WITHOUT CHANGING THE COLOUR?
//
// Two claims, both checkable, and a picture so an owner can see what adopting
// it buys before they touch their file:
//
//   1. the MEAN colour is preserved — this adds grain, it does not restyle
//   2. the EDGE DENSITY rises from ~0 to something the eye can attach to
//
// Edge density is the measure that matters here: B's diagnosis is that a flat
// quad "has no grain for the eye to attach to and no joints to give it scale".
// A flat fill has zero internal edges by definition; a material has many.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = aim('http://localhost:4188/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 620 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

const r = await p.evaluate(async () => {
  const mod = await import('/src/proto/ct/paint.ts').catch(() => null);
  if (!mod || !mod.slabTex) return { err: 'slabTex not importable from the bundle' };
  const cases = [
    { name: 'civic landing  3.6x4.1', base: '#7d7d79', w: 3.6, d: 4.1, joint: 1.5 },
    { name: 'park path      2.0x6.0', base: '#6f6a58', w: 2.0, d: 6.0, joint: 0, grain: 0.18 },
    { name: 'library slab   6.0x8.0', base: '#8a867c', w: 6.0, d: 8.0, joint: 2.0 },
  ];
  const out = [];
  for (const c of cases) {
    const t = mod.slabTex({ wMeters: c.w, dMeters: c.d, base: c.base, joint: c.joint, grain: c.grain });
    const im = t.image;
    const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
    const cx = cv.getContext('2d'); cx.drawImage(im, 0, 0);
    const d = cx.getImageData(0, 0, cv.width, cv.height).data;
    let sr = 0, sg = 0, sb = 0, n = 0, edges = 0, cells = 0;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
      const i = (y * cv.width + x) * 4;
      sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; n++;
      if (x) { cells++; const j = i - 4;
        if (Math.abs(d[i]-d[j]) + Math.abs(d[i+1]-d[j+1]) + Math.abs(d[i+2]-d[j+2]) > 24) edges++; }
    }
    const hex = (v) => Math.round(v).toString(16).padStart(2, '0');
    out.push({ name: c.name, base: c.base, px: `${im.width}x${im.height}`,
               mean: '#' + hex(sr/n) + hex(sg/n) + hex(sb/n),
               edgePct: +(100 * edges / cells).toFixed(1) });
  }
  return { out };
});
await b.close();
if (r.err) { console.error('ABORT:', r.err); process.exit(3); }

const bias = (a, bx) => {
  const A = [1,3,5].map(i => parseInt(a.slice(i,i+2),16));
  const B = [1,3,5].map(i => parseInt(bx.slice(i,i+2),16));
  return Math.round(Math.max(...A.map((v,k)=>Math.abs(v-B[k]))));
};
console.log('\n  surface                 canvas     your base -> mean       drift   edge density');
let bad = 0;
for (const c of r.out) {
  const dr = bias(c.base, c.mean);
  if (dr > 12 || c.edgePct < 3) bad++;
  console.log(`  ${c.name.padEnd(22)} ${c.px.padStart(9)}   ${c.base} -> ${c.mean}   ${String(dr).padStart(4)}   ${String(c.edgePct).padStart(6)}%`);
}
console.log('\n  drift = worst channel shift from the colour you passed in (want small:');
console.log('  it must keep your artwork). edge density = grain the eye can attach to.\n');
if (bad) { console.error(`FAIL: ${bad} case(s) either restyled the colour or produced no grain.`); process.exit(1); }
console.log('OK  keeps the colour, adds the material.');
