// Structural fingerprint of the built world — the right check for a pure
// refactor, since screenshots are not reproducible (the sim keeps running).
//
// Emits three independent fingerprints:
//   textures  — FNV-1a over every unique texture's pixels (all the authored art)
//   structure — multiset of type|geometry|params|material, position-independent
//   places    — sorted rounded positions (dynamic props make this a bit noisy)
//
// Usage: node scripts/scenedump.mjs <label>   -> shots/<label>.json
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const label = process.argv[2];
if (!label) { console.error('usage: scenedump.mjs <label>'); process.exit(2); }

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
// The art layer paints with UNSEEDED Math.random (dither(), brick grime, tree
// dapples, rain). Seed it here so texture pixels are reproducible for the
// fingerprint. Test-harness only — the shipped world keeps its live grain.
await page.addInitScript(() => {
  let s = 0x9e3779b9 >>> 0;
  Math.random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
});
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct?.scene !== undefined, { timeout: 10000 });

const dump = await page.evaluate(() => {
  const scene = window.__ct.scene();
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const texHash = (t) => {
    const img = t?.image;
    if (!img || !img.width) return 'none';
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const g = cv.getContext('2d', { willReadFrequently: true });
    try { g.drawImage(img, 0, 0); } catch { return 'undrawable'; }
    const d = g.getImageData(0, 0, cv.width, cv.height).data;
    let h = 0x811c9dc5;
    for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 0x01000193) >>> 0; }
    return `${img.width}x${img.height}:${h.toString(16)}`;
  };
  const seenTex = new Map();
  const matSig = (m) => {
    if (!m) return '-';
    const one = (x) => {
      let t = 'none';
      if (x.map) { if (!seenTex.has(x.map.uuid)) seenTex.set(x.map.uuid, texHash(x.map)); t = seenTex.get(x.map.uuid); }
      return `${x.type}:${x.color?.getHexString?.() ?? '-'}:${t}:${x.transparent ? 1 : 0}:${x.alphaTest ?? 0}`;
    };
    return Array.isArray(m) ? m.map(one).join('|') : one(m);
  };
  const geomSig = (g) => {
    if (!g) return '-';
    const p = g.parameters ? Object.entries(g.parameters).map(([k, v]) => `${k}=${typeof v === 'number' ? +v.toFixed(4) : v}`).sort().join(',') : '';
    const n = g.attributes?.position?.count ?? 0;
    return `${g.type}(${p})#${n}`;
  };
  const structure = [], places = [], textures = [];
  scene.traverse((o) => {
    structure.push(`${o.type}|${geomSig(o.geometry)}|${matSig(o.material)}`);
    places.push(`${o.type}@${o.position.x.toFixed(2)},${o.position.y.toFixed(2)},${o.position.z.toFixed(2)}`);
  });
  for (const [, h] of seenTex) textures.push(h);
  structure.sort(); places.sort(); textures.sort();
  return {
    objects: structure.length,
    uniqueTextures: textures.length,
    textures: fnv(textures.join('\n')),
    structure: fnv(structure.join('\n')),
    places: fnv(places.join('\n')),
    _textures: textures, _structure: structure, _places: places,
  };
});
await browser.close();

mkdirSync('shots', { recursive: true });
writeFileSync(`shots/${label}.json`, JSON.stringify(dump, null, 1));
console.log(`objects=${dump.objects} uniqueTextures=${dump.uniqueTextures}`);
console.log(`textures=${dump.textures} structure=${dump.structure} places=${dump.places}`);
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
