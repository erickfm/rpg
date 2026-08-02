// Is the shop glass a lit room, or a black hole?
//
// The user's complaint that the depth work existed to fix was that shopfront
// glass read as a black rectangle. shopInteriorTex paints a room behind every
// shopfront — a lit ceiling falling off downward, a back wall, shelving, a
// counter edge — and my note at the time set the rule in one line: "DARK BUT
// NEVER BLACK — a black rectangle is the 'glass is a black hole' complaint the
// depth work existed to fix."
//
// That rule was written in prose and guarded by nothing. It is checkable: a
// black hole has a mean luminance near zero and is mostly near-black texels; a
// painted room is dark and varied.
//
// Measured across all 18 backings today: mean 45 of 255, near-black 0.1%.
// Fails below mean 20, or above 20% near-black. Both are generous against the
// measurement rather than tight against it, because the failure being guarded
// is "somebody made it black again", not "somebody made it a shade darker".
//
//   node scripts/shop-interior.mjs
//   node scripts/shop-interior.mjs --selftest
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const SELFTEST = process.argv.includes('--selftest');
const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);

const rows = await p.evaluate(([selftest]) => {
  const s = window.__ct.scene(); const seen = new Set(); const out = [];
  s.traverse((o) => {
    if (!o.isMesh || o.geometry?.type !== 'PlaneGeometry') return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      const im = m?.map?.image;
      if (!im?.width || im.height !== 67 || seen.has(m.map.uuid)) continue;
      seen.add(m.map.uuid);
      const c = document.createElement('canvas');
      c.width = im.width; c.height = im.height;
      const g = c.getContext('2d');
      g.drawImage(im, 0, 0);
      if (selftest && out.length === 0) { g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); }
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let sum = 0, n = 0, dark = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 128) continue;
        const L = (d[i] + d[i + 1] + d[i + 2]) / 3;
        sum += L; n++;
        if (L < 24) dark++;
      }
      if (n) out.push({ mean: +(sum / n).toFixed(0), dark: +(100 * dark / n).toFixed(1) });
    }
  });
  return out;
}, [SELFTEST]);
await b.close();

if (!rows.length) { console.error('no shopfront backings found — this check is inert, fix it'); process.exit(2); }
const bad = rows.filter((r) => r.mean < 20 || r.dark > 20);
console.log(`${rows.length} shopfront backings: mean luminance ${Math.min(...rows.map((r) => r.mean))}–${Math.max(...rows.map((r) => r.mean))}, worst near-black ${Math.max(...rows.map((r) => r.dark))}%`);
if (SELFTEST) {
  if (bad.length) { console.log('SELFTEST PASSED — a blacked-out shop interior was caught'); process.exit(0); }
  console.error('SELFTEST FAILED — an interior was painted solid black and this did not notice.');
  process.exit(2);
}
if (!bad.length) { console.log('  dark but never black — there is a room behind every window'); process.exit(0); }
console.error(`  ${bad.length} shopfront(s) read as a BLACK HOLE rather than a room.`);
console.error('  See shopInteriorTex in ct/tex-world.ts — the glass keeps its depth, but there');
console.error('  has to be something to see through it.');
process.exit(1);
