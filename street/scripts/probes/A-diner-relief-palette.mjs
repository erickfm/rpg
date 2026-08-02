// WHAT COLOUR IS THE DINER'S PROJECTING MOULDING, AND WHAT COLOUR IS ITS
// FASCIA? An investigation, not an assertion — it prints a table.
//
// `ct/street.ts` hands `shopfrontRelief` `trim: b.col`, the roster colour, and
// the relief tints its cornice / bed mould / cill from it. Four of the five
// characters use that same roster colour as their painted fascia, so the
// projecting mouldings belong to the front they frame. `dinerFront` does not:
// its signature is `(brick, nm, wM)` — `awning` is never passed — and it
// paints a stainless fascia from a constant. So the diner is the one shop on
// the block whose mouldings are a different material from the band they sit
// on, and this reads it out of the LIVE world rather than off the source.
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4188/';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);

const rows = await p.evaluate(() => {
  const fr = globalThis.__frontages || [];
  // three.js stores material colour LINEAR with ColorManagement on, so a
  // material set from '#8a5a22' reads back as (0.184, 0.075, 0.012). Printing
  // that raw gives a table of near-blacks that looks like a bug in the world
  // rather than in the units — convert back to sRGB before saying a number.
  const enc = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
  const hex = (c) => '#' + [c.r, c.g, c.b]
    .map((v) => Math.round(Math.min(1, Math.max(0, enc(v))) * 255).toString(16).padStart(2, '0')).join('');
  const lum = (c) => 0.2126 * enc(c.r) + 0.7152 * enc(c.g) + 0.0722 * enc(c.b);
  // THREE is not a global in the built bundle, so read world position off
  // matrixWorld's translation rather than importing a Vector3.
  const scene = window.__ct.scene();
  scene.updateMatrixWorld(true);
  const meshes = [];
  scene.traverse((n) => {
    if (!n.isMesh || Array.isArray(n.material)) return;
    const e = n.matrixWorld.elements;
    meshes.push({ x: e[12], y: e[13], z: e[14], m: n.material });
  });
  const out = [];
  for (const f of fr) {
    if (f.axis !== 'z') continue;                      // main block only
    const lo = Math.min(f.loWorld, f.hiWorld), hi = Math.max(f.loWorld, f.hiWorld);
    // the relief mouldings are plain-COLOURED boxes (no map) standing on the
    // facade plane inside this frontage's span, below the shop band's head.
    const cols = new Map();
    for (const q of meshes) {
      if (Math.abs(q.x - f.facePos) > 1.2) continue;
      if (q.z < lo || q.z > hi) continue;
      if (q.y <= 0 || q.y > 4.6) continue;
      if (q.m.map || !q.m.color) continue;
      const h = hex(q.m.color);
      cols.set(h, (cols.get(h) || 0) + 1);
    }
    out.push({
      name: f.name,
      moulding: [...cols.entries()].sort((a, c) => c[1] - a[1])
        .map(([h, n]) => `${h}x${n}`).join(' '),
    });
  }
  return out;
});
console.log('\nprojecting mouldings, by frontage (sRGB x count)');
for (const r of rows) console.log(`  ${r.name.padEnd(13)} ${r.moulding}`);

// ── and how much of each painted band is one flat pale neutral ─────────────
//
// The second half of "looks really bad": not what colour the mouldings are but
// how much of the front is a single cold grey. Read the painter's OWN canvas
// rather than a screenshot — a screenshot carries the sky, the grade and the
// dither, and GOTCHAS 1 says the grain differs every load anyway.
const bands = await p.evaluate(() => {
  const scene = window.__ct.scene();
  scene.updateMatrixWorld(true);
  const fr = globalThis.__frontages || [];
  const out = [];
  for (const f of fr) {
    if (f.axis !== 'z') continue;
    const lo = Math.min(f.loWorld, f.hiWorld), hi = Math.max(f.loWorld, f.hiWorld);
    // THE BAND IS FOUND BY ITS SHAPE, not by its position. The shop box is
    // centred on the building's DEPTH, tens of metres back from the facade
    // plane the frontage publishes, so an x test misses every one of them —
    // it found two canvases out of seven and both were something else. A
    // shopfront band is the only texture on that box whose aspect is the
    // frontage's own width over SHOP_BAND_H.
    const WANT = f.frontageM / 4.2;
    let canvas = null, best = 0.12;
    scene.traverse((n) => {
      if (!n.isMesh || !Array.isArray(n.material)) return;
      const e = n.matrixWorld.elements;
      if (e[14] < lo || e[14] > hi) return;
      if (e[13] < 1.4 || e[13] > 2.8) return;        // the shop band, not the wall above
      for (const m of n.material) {
        const img = m && m.map && m.map.image;
        if (!img || img.width < 100) continue;
        const err = Math.abs(img.width / img.height - WANT) / WANT;
        if (err < best) { best = err; canvas = img; }
      }
    });
    if (!canvas) { out.push({ name: f.name, note: 'no band canvas found' }); continue; }
    const c = document.createElement('canvas');
    c.width = canvas.width; c.height = canvas.height;
    c.getContext('2d').drawImage(canvas, 0, 0);
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let pale = 0, total = 0;
    const hist = new Map();
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      total++;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      // "pale neutral": bright, and nearly colourless. A warm painted board
      // fails the chroma test however light it is; stainless passes.
      if (mx > 140 && mx - mn < 22) pale++;
      const key = `${r >> 4},${g >> 4},${b >> 4}`;
      hist.set(key, (hist.get(key) || 0) + 1);
    }
    const top = [...hist.entries()].sort((a, z) => z[1] - a[1])[0];
    // THE FASCIA'S OWN COLOUR, so the moulding tint can be compared against
    // the band it frames rather than against the roster entry that set it.
    // Modal tone over the sign band's rows — every painter puts its fascia in
    // the top ~1.1 m of the canvas, above the opening.
    const fh2 = new Map();
    for (let y = Math.round(c.height * 0.06); y < Math.round(c.height * 0.26); y++) {
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        fh2.set(`${d[i]},${d[i + 1]},${d[i + 2]}`, (fh2.get(`${d[i]},${d[i + 1]},${d[i + 2]}`) || 0) + 1);
      }
    }
    const fas = [...fh2.entries()].sort((a, z) => z[1] - a[1])[0][0].split(',').map(Number);
    out.push({
      name: f.name, w: c.width, h: c.height,
      pale: (100 * pale / total).toFixed(1),
      topShare: (100 * top[1] / total).toFixed(1),
      fascia: '#' + fas.map((v) => v.toString(16).padStart(2, '0')).join(''),
    });
  }
  return out;
});
console.log('\nshare of each painted shop band that is a BRIGHT NEUTRAL (max>140, chroma<22)');
for (const r of bands) {
  console.log(r.note
    ? `  ${r.name.padEnd(13)} ${r.note}`
    : `  ${r.name.padEnd(13)} ${String(r.pale).padStart(5)}%   (canvas ${r.w}x${r.h}, single commonest tone ${r.topShare}%)`);
}

// ── the finding: does each front's MOULDING belong to its FASCIA? ──────────
const hue = (h) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn;
  if (c < 1e-6) return null;                                 // neutral: no hue
  const t = mx === r ? ((g - b) / c) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4;
  return (t * 60 + 360) % 360;
};
console.log('\nDOES THE PROJECTING MOULDING BELONG TO THE FASCIA IT FRAMES?');
for (const r of bands) {
  if (r.note) continue;
  const row = rows.find((q) => q.name === r.name);
  // the brightest tinted moulding — skip the two shared constants (#332e28
  // jamb, #2a2620 plinth), which every front wears
  const tint = row.moulding.split(' ').map((s) => s.split('x')[0])
    .filter((h) => h !== '#332e28' && h !== '#2a2620')[0];
  const hf = hue(r.fascia), hm = hue(tint);
  const d = hf === null || hm === null ? null : Math.min(Math.abs(hf - hm), 360 - Math.abs(hf - hm));
  console.log(`  ${r.name.padEnd(13)} fascia ${r.fascia}  moulding ${tint}  `
    + (d === null
      ? `— fascia is NEUTRAL, moulding is hue ${Math.round(hm)}°  ** MISMATCH **`
      : `hue gap ${Math.round(d)}°${d > 40 ? '  ** MISMATCH **' : ''}`));
}


await b.close();
