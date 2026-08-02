// ITEM 97 — DID THE REST OF THE WORLD'S ART ACTUALLY CHANGE, OR DID ITS GRAIN
// JUST RE-ROLL?
//
// `npm run fpdiff` reported 849 of 1461 textures differing across this change,
// which if taken at face value would mean a facade repaint had repainted half
// the city. The fingerprint is not lying and it is not noisy — two runs of the
// same build come back IDENTICAL, verified. But it seeds ONE global
// `Math.random` and then lets the whole world paint off that single stream, and
// `paint.ts:141-170` (`dither`, `grain`) draws from it per texture. Add seven
// textures anywhere and every texture painted after them gets a different slice
// of the sequence: same art, different grain, different hash.
//
// So this measures the art with the grain held CONSTANT — `Math.random` pinned
// to a fixed value, so dither and grain paint the same thing at every call site
// no matter what order they run in. Anything that still differs is authored
// pixels, which is the thing the fp recipe is actually asking about.
//
// Usage: node scripts/probes/w46-art-without-grain.mjs <label>
//        node scripts/probes/w46-art-without-grain.mjs --diff a b
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

if (process.argv[2] === '--diff') {
  const A = JSON.parse(readFileSync(`shots/${process.argv[3]}.grain.json`, 'utf8'));
  const B = JSON.parse(readFileSync(`shots/${process.argv[4]}.grain.json`, 'utf8'));
  const count = (xs) => { const m = new Map(); for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1); return m; };
  const ma = count(A.tex), mb = count(B.tex);
  const only = (x, y) => [...x].filter(([k, n]) => (y.get(k) ?? 0) < n).map(([k, n]) => `${k} x${n - (y.get(k) ?? 0)}`);
  const gone = only(ma, mb), added = only(mb, ma);
  console.log(`textures: ${A.tex.length} -> ${B.tex.length}`);
  console.log(`\nonly in ${process.argv[3]} (${gone.length}):`);
  for (const s of gone.slice(0, 40)) console.log('  - ' + s);
  console.log(`\nonly in ${process.argv[4]} (${added.length}):`);
  for (const s of added.slice(0, 40)) console.log('  + ' + s);
  process.exit(0);
}

const label = process.argv[2];
if (!label) { console.error('usage: w46-art-without-grain.mjs <label> | --diff a b'); process.exit(2); }
const URL = process.env.SHOT_URL ?? 'http://localhost:4180/';
const b = await chromium.launch();
const p = await b.newPage();
// the grain, pinned. Not seeded — PINNED: a seeded stream is still positional.
await p.addInitScript(() => { Math.random = () => 0.4242; });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(2500);

const tex = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const seen = new Set(); const out = [];
  const fnv = (d) => { let h = 0x811c9dc5; for (let i = 0; i < d.length; i += 7) { h ^= d[i]; h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  // drawImage into a scratch canvas, exactly as scripts/scenedump.mjs does —
  // a pixTex is not always a canvas by the time three.js has it, and reading
  // `image.getContext` directly found 1 texture where the real count is 1461.
  const cv = document.createElement('canvas');
  const g2 = cv.getContext('2d', { willReadFrequently: true });
  s.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      // DEDUPE BY OBJECT, NOT BY uuid. three.js builds a uuid out of
      // Math.random, so pinning the grain makes every texture in the scene
      // report the SAME uuid — 4469 mapped materials collapsed to "1 unique
      // texture" and the probe cheerfully said the art was identical. A probe
      // whose key is destroyed by the very thing it is controlling for.
      const t = m && m.map; const im = t && t.image;
      if (!im || !im.width || seen.has(t)) continue;
      seen.add(t);
      cv.width = im.width; cv.height = im.height;
      try { g2.drawImage(im, 0, 0); } catch { continue; }
      out.push(`${im.width}x${im.height}:${fnv(g2.getImageData(0, 0, im.width, im.height).data)}`);
    }
  });
  return out.sort();
});
mkdirSync('shots', { recursive: true });
writeFileSync(`shots/${label}.grain.json`, JSON.stringify({ tex }));
console.log(`shots/${label}.grain.json — ${tex.length} unique textures, grain pinned`);
await b.close();
