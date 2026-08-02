// A SHOPFRONT'S PROJECTING MOULDINGS ARE THE SAME MATERIAL AS ITS FASCIA.
//
// An ASSERTION, and it exits non-zero. This is the fault the whole facade
// stretch started from: `ct/street.ts` hands `shopfrontRelief` the ROSTER
// colour as `trim`, and four of six characters happen to use that same colour
// for their painted fascia — so their cornice, bed mould and cill belong to the
// band they frame. `dinerFront` never receives it and paints stainless from a
// constant, so the diner wore a MUSTARD-BROWN cornice and cill wrapped around a
// steel front. Measured at a 170 degree hue gap where five of seven fronts
// measured 0-1.
//
// `joineryOf()` fixed it by making the painter declare its own joinery, and
// NOTHING GUARDED THAT. The next character painter added to this file gets the
// roster colour by default, and if its fascia is not that colour the mismatch
// comes back silently — there is no error, no warning, just a front that looks
// slightly cheap in a way nobody can name. That is exactly how the diner's
// lasted as long as it did.
//
// THE THRESHOLD IS NOT TUNED. 40 degrees is far outside the 0-3 that every
// matching front measures and far inside the 170-175 the mismatches do; there
// is no front anywhere near it, so it is not a number chosen to make today's
// street pass (GOTCHAS 27).
//
// A-1 TAX IS AN EXPLICIT, NAMED EXCEPTION rather than a loosened threshold.
// Its navy is the shop's identity colour and its cream band is a CLOTH BANNER
// hung on the brick, not a fascia — navy joinery under a cloth banner is
// coherent, and nobody has complained. Naming it with a reason is what
// checks-registered.mjs asks of its own exempt list, and it is honest in a way
// that widening the tolerance to 180 would not be: widening would also stop
// this catching the real thing.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4188/';
const MAX_GAP = 40;                       // degrees of hue
const EXCEPT = new Map([
  ['A-1 TAX', 'navy is the shop identity; its cream band is a cloth banner, not a fascia'],
]);

const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

const rows = await p.evaluate(() => {
  // three.js stores material colour LINEAR; convert before comparing to a
  // canvas pixel, which is sRGB. Getting this wrong prints a table of
  // near-blacks and looks like a fault in the world rather than in the units.
  const enc = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
  const hex = (c) => '#' + [c.r, c.g, c.b]
    .map((v) => Math.round(Math.min(1, Math.max(0, enc(v))) * 255).toString(16).padStart(2, '0')).join('');
  const scene = window.__ct.scene();
  scene.updateMatrixWorld(true);
  const boxes = [];
  scene.traverse((n) => {
    if (!n.isMesh || Array.isArray(n.material)) return;
    const m = n.material;
    if (!m || m.map || !m.color) return;              // a moulding is plain-coloured
    const e = n.matrixWorld.elements;
    boxes.push({ x: e[12], y: e[13], z: e[14], hex: hex(m.color) });
  });
  const out = [];
  for (const f of (globalThis.__frontages || [])) {
    const lo = Math.min(f.loWorld, f.hiWorld), hi = Math.max(f.loWorld, f.hiWorld);
    // the mouldings: plain-coloured boxes on this frontage, minus the two
    // constants every front wears (the dark jamb and the plinth)
    const tints = boxes.filter((q) => {
      const along = f.axis === 'z' ? q.z : q.x;
      const across = f.axis === 'z' ? q.x : q.z;
      return Math.abs(across - f.facePos) <= 1.2 && along >= lo && along <= hi
        && q.y > 0 && q.y < 4.6 && q.hex !== '#332e28' && q.hex !== '#2a2620';
    }).map((q) => q.hex);
    if (!tints.length) continue;
    // the fascia: modal tone over the sign band's rows on the painted canvas
    const WANT = f.frontageM / 4.2;
    let img = null, best = 0.12;
    scene.traverse((n) => {
      if (!n.isMesh || !Array.isArray(n.material)) return;
      const e = n.matrixWorld.elements;
      const along = f.axis === 'z' ? e[14] : e[12];
      if (along < lo || along > hi || e[13] < 1.4 || e[13] > 2.8) return;
      for (const m of n.material) {
        const im = m && m.map && m.map.image;
        if (!im || im.width < 100) continue;
        const err = Math.abs(im.width / im.height - WANT) / WANT;
        if (err < best) { best = err; img = im; }
      }
    });
    if (!img) continue;
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const cx = c.getContext('2d');
    cx.drawImage(img, 0, 0);
    const d = cx.getImageData(0, 0, c.width, c.height).data;
    const h = new Map();
    for (let y = Math.round(c.height * 0.06); y < Math.round(c.height * 0.26); y++) {
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        const k = `${d[i]},${d[i + 1]},${d[i + 2]}`;
        h.set(k, (h.get(k) || 0) + 1);
      }
    }
    const fas = [...h.entries()].sort((a, z) => z[1] - a[1])[0][0].split(',').map(Number);
    out.push({
      name: f.name,
      fascia: '#' + fas.map((v) => v.toString(16).padStart(2, '0')).join(''),
      moulding: tints[0],
    });
  }
  return out;
});
await b.close();

const hue = (h) => {
  const [r, g, bl] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl), c = mx - mn;
  if (c < 0.02) return null;                                  // neutral: no hue
  const t = mx === r ? ((g - bl) / c) % 6 : mx === g ? (bl - r) / c + 2 : (r - g) / c + 4;
  return (t * 60 + 360) % 360;
};

// GOTCHAS 34: assert the population before the absence. "every front matches"
// is free over an empty set, and this predicate — plain-coloured boxes near a
// facade plane — is exactly the kind that silently stops matching.
if (rows.length < 5) {
  console.error(`ABORT: only ${rows.length} frontages yielded a fascia AND mouldings; `
    + 'the predicate has stopped seeing them, so the verdict below would be free.');
  process.exit(3);
}

console.log(`\n  ${rows.length} shopfronts with both a painted fascia and projecting mouldings\n`);
const bad = [];
for (const r of rows) {
  const hf = hue(r.fascia), hm = hue(r.moulding);
  const gap = hf === null || hm === null ? 180 : Math.min(Math.abs(hf - hm), 360 - Math.abs(hf - hm));
  const excused = EXCEPT.get(r.name);
  const ok = gap <= MAX_GAP || !!excused;
  if (!ok) bad.push({ ...r, gap });
  console.log(`  ${ok ? (excused ? 'EXPT' : 'OK  ') : 'FAIL'} ${r.name.padEnd(13)} `
    + `fascia ${r.fascia}  moulding ${r.moulding}  hue gap ${Math.round(gap)}deg`
    + (excused ? `\n         allowed: ${excused}` : ''));
}
console.log('');
if (bad.length) {
  console.error(`FAIL: ${bad.length} shopfront(s) whose projecting mouldings are a different `
    + `material from the fascia they frame — ${bad.map((r) => r.name).join(', ')}. `
    + 'The painter must declare its own joinery (see joineryOf in ct/tex-world.ts).');
  process.exit(1);
}
console.log('OK  every shopfront\'s mouldings belong to the fascia they frame.');
